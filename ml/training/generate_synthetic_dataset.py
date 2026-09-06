import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
SIMULATOR_DIR = PROJECT_ROOT / "simulator"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "synthetic"

sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SIMULATOR_DIR))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")

from database.session import SessionLocal
from models.sensor_models import Zone, SensorNode, SensorReadingRaw, SensorReadingProcessed
from models.risk_models import Risk
from services.feature_engineering import compute_features
from rules.risk_engine import evaluate_risk, save_risk_evaluation
from scenarios import SCENARIO_LIST, ScenarioSensorNode

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

ZONE_NODE_COUNTS = {"A": 8, "B": 7, "C": 8, "D": 7}
SYNTHETIC_NODE_PREFIX = "SYNTH"
BASE_TIME = datetime(2024, 1, 1, 0, 0, 0)


def get_or_create_zone(db, zone_code):
    zone = db.query(Zone).filter(Zone.zone_code == zone_code).one_or_none()
    if zone is not None:
        return zone, False
    zone = Zone(zone_code=zone_code, name=f"Zone {zone_code}")
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone, True


def create_synthetic_node(db, zone, zone_code, index):
    node_id_str = f"{SYNTHETIC_NODE_PREFIX}-{zone_code}-{index:02d}"
    node = SensorNode(
        node_id=node_id_str,
        zone_id=zone.id,
        data_source="simulated",
        latitude=20.0 + (index * 0.001),
        longitude=80.0 + (index * 0.001),
        is_reference_node=False,
        calibration_status="calibrated",
        status="offline",
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


def ingest_synthetic_reading(db, db_node, zone, reading_dict, reading_time):
    raw_reading = SensorReadingRaw(
        node_id=db_node.id,
        zone_id=zone.id,
        reading_timestamp=reading_time,
        sequence_number=reading_dict["sequence_number"],
        data_source=reading_dict["data_source"],
        tilt_x=reading_dict["tilt_x"],
        tilt_y=reading_dict["tilt_y"],
        tilt_magnitude=reading_dict["tilt_magnitude"],
        displacement_mm=reading_dict["displacement_mm"],
        displacement_rate=reading_dict["displacement_rate"],
        vibration_rms=reading_dict["vibration_rms"],
        vibration_peak=reading_dict["vibration_peak"],
        vibration_variance=reading_dict["vibration_variance"],
        crack_width_mm=reading_dict["crack_width_mm"],
        crack_detected=reading_dict["crack_detected"],
        temperature=reading_dict["temperature"],
        humidity=reading_dict["humidity"],
        battery_voltage=reading_dict["battery_voltage"],
        rssi=reading_dict["rssi"],
        packet_loss=reading_dict["packet_loss"],
        sensor_status=reading_dict["sensor_status"],
        calibration_status=reading_dict["calibration_status"],
    )
    db.add(raw_reading)
    db.flush()

    features = compute_features(db, db_node, raw_reading)

    processed_reading = SensorReadingProcessed(
        raw_reading_id=raw_reading.id,
        node_id=db_node.id,
        zone_id=zone.id,
        reading_timestamp=reading_time,
        data_source=reading_dict["data_source"],
        tilt_rate=features["tilt_rate"],
        displacement_rate_smoothed=features["displacement_rate_smoothed"],
        crack_growth_rate=features["crack_growth_rate"],
        rolling_mean_displacement=features["rolling_mean_displacement"],
        rolling_std_displacement=features["rolling_std_displacement"],
        vibration_energy=features["vibration_energy"],
        neighbor_displacement_diff=features["neighbor_displacement_diff"],
        missing_packet_count=features["missing_packet_count"],
        battery_trend=features["battery_trend"],
        rssi_trend=features["rssi_trend"],
        data_quality_score=features["data_quality_score"],
    )
    db.add(processed_reading)

    db_node.last_seen_at = reading_time
    db_node.status = "online"
    if reading_dict.get("calibration_status") is not None:
        db_node.calibration_status = reading_dict["calibration_status"]

    db.commit()
    db.refresh(raw_reading)
    db.refresh(processed_reading)

    risk_result = evaluate_risk(db, db_node, raw_reading, processed_reading, now=reading_time)
    risk = save_risk_evaluation(db, risk_result)

    return raw_reading, processed_reading, features, risk


def build_dataset_row(zone_code, node_id_str, scenario, reading_dict, reading_time, features, risk):
    return {
        "node_id": node_id_str,
        "zone_code": zone_code,
        "scenario": scenario,
        "sequence_number": reading_dict["sequence_number"],
        "reading_timestamp": reading_time,
        "tilt_x": reading_dict["tilt_x"],
        "tilt_y": reading_dict["tilt_y"],
        "tilt_magnitude": reading_dict["tilt_magnitude"],
        "displacement_mm": reading_dict["displacement_mm"],
        "displacement_rate": reading_dict["displacement_rate"],
        "vibration_rms": reading_dict["vibration_rms"],
        "vibration_peak": reading_dict["vibration_peak"],
        "vibration_variance": reading_dict["vibration_variance"],
        "crack_width_mm": reading_dict["crack_width_mm"],
        "crack_detected": reading_dict["crack_detected"],
        "temperature": reading_dict["temperature"],
        "humidity": reading_dict["humidity"],
        "battery_voltage": reading_dict["battery_voltage"],
        "rssi": reading_dict["rssi"],
        "packet_loss": reading_dict["packet_loss"],
        "sensor_status": reading_dict["sensor_status"],
        "calibration_status": reading_dict["calibration_status"],
        "tilt_rate": features["tilt_rate"],
        "displacement_rate_smoothed": features["displacement_rate_smoothed"],
        "crack_growth_rate": features["crack_growth_rate"],
        "rolling_mean_displacement": features["rolling_mean_displacement"],
        "rolling_std_displacement": features["rolling_std_displacement"],
        "vibration_energy": features["vibration_energy"],
        "neighbor_displacement_diff": features["neighbor_displacement_diff"],
        "missing_packet_count": features["missing_packet_count"],
        "battery_trend": features["battery_trend"],
        "rssi_trend": features["rssi_trend"],
        "data_quality_score": features["data_quality_score"],
        "risk_level": risk.risk_level,
        "rule_triggered": risk.rule_triggered,
        "sensor_health_status": risk.sensor_health_status,
        "data_quality_status": risk.data_quality_status,
        "neighbor_agreement_count": risk.neighbor_agreement_count,
        "persistence_seconds": risk.persistence_seconds,
    }


def generate_dataset(db, readings_per_scenario, sampling_interval_seconds):
    rows = []
    created_zone_ids = []
    created_node_ids = []

    for zone_code, node_count in ZONE_NODE_COUNTS.items():
        zone, zone_created = get_or_create_zone(db, zone_code)
        if zone_created:
            created_zone_ids.append(zone.id)

        zone_nodes = []
        for index in range(1, node_count + 1):
            db_node = create_synthetic_node(db, zone, zone_code, index)
            created_node_ids.append(db_node.id)
            sim_node = ScenarioSensorNode(
                node_id=db_node.node_id,
                zone_id=zone_code,
                data_source="simulated",
                sampling_interval_seconds=sampling_interval_seconds,
                scenario=SCENARIO_LIST[0],
            )
            zone_nodes.append((db_node, sim_node))

        total_ticks = len(SCENARIO_LIST) * readings_per_scenario
        logger.info("Zone %s: %s nodes, %s ticks", zone_code, len(zone_nodes), total_ticks)

        for tick in range(total_ticks):
            scenario_index = tick // readings_per_scenario
            reading_time = BASE_TIME + timedelta(seconds=tick * sampling_interval_seconds)

            for node_offset, (db_node, sim_node) in enumerate(zone_nodes):
                node_scenario_index = (scenario_index + node_offset) % len(SCENARIO_LIST)
                node_scenario = SCENARIO_LIST[node_scenario_index]
                if sim_node.scenario != node_scenario:
                    sim_node.set_scenario(node_scenario)

                reading_dict = sim_node.generate_reading()
                if reading_dict is None:
                    continue

                _, _, features, risk = ingest_synthetic_reading(db, db_node, zone, reading_dict, reading_time)

                rows.append(
                    build_dataset_row(
                        zone_code, db_node.node_id, node_scenario, reading_dict, reading_time, features, risk
                    )
                )

            if tick % 100 == 0:
                logger.info("Zone %s tick %s/%s", zone_code, tick, total_ticks)

    return rows, created_zone_ids, created_node_ids


def cleanup_synthetic_data(db, node_ids, zone_ids):
    if node_ids:
        db.query(Risk).filter(Risk.node_id.in_(node_ids)).delete(synchronize_session=False)
        db.commit()
        db.query(SensorNode).filter(SensorNode.id.in_(node_ids)).delete(synchronize_session=False)
        db.commit()
    if zone_ids:
        db.query(Zone).filter(Zone.id.in_(zone_ids)).delete(synchronize_session=False)
        db.commit()
    logger.info("Cleanup complete: removed %s synthetic nodes, %s synthetic zones", len(node_ids), len(zone_ids))


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic ML training dataset from simulator scenarios")
    parser.add_argument("--readings-per-scenario", type=int, default=60)
    parser.add_argument("--sampling-interval-seconds", type=int, default=60)
    parser.add_argument("--output-dir", type=str, default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--keep-data", action="store_true")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        rows, created_zone_ids, created_node_ids = generate_dataset(
            db, args.readings_per_scenario, args.sampling_interval_seconds
        )

        df = pd.DataFrame(rows)
        timestamp_suffix = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_path = output_dir / f"training_dataset_{timestamp_suffix}.csv"
        df.to_csv(output_path, index=False)
        logger.info("Wrote %s rows to %s", len(df), output_path)
        logger.info("Risk level distribution:\n%s", df["risk_level"].value_counts().to_string())

        if not args.keep_data:
            cleanup_synthetic_data(db, created_node_ids, created_zone_ids)
        else:
            logger.info("--keep-data set, synthetic rows left in database for inspection")
    finally:
        db.close()


if __name__ == "__main__":
    main()
