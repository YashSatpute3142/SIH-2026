from datetime import datetime
from sqlalchemy.orm import Session

from models.sensor_models import SensorNode, SensorReadingRaw, SensorReadingProcessed
from models.risk_models import Risk
from rules import thresholds
from rules.sensor_health import evaluate_sensor_health
from rules.field_thresholds import evaluate_all_fields, LEVEL_RANK
from rules.persistence import apply_persistence, get_previous_risk_state
from rules.neighbor_agreement import apply_neighbor_agreement


RECOMMENDED_ACTION_BY_LEVEL = {
    "GREEN": thresholds.RECOMMENDED_ACTION_GREEN,
    "YELLOW": thresholds.RECOMMENDED_ACTION_YELLOW,
    "ORANGE": thresholds.RECOMMENDED_ACTION_ORANGE,
    "RED": thresholds.RECOMMENDED_ACTION_RED,
    "GREY": thresholds.RECOMMENDED_ACTION_GREY,
}


def get_consecutive_candidate_count(
    db: Session,
    node: SensorNode,
    raw_reading: SensorReadingRaw,
    candidate_level: str,
) -> tuple:
    history = (
        db.query(SensorReadingProcessed)
        .filter(SensorReadingProcessed.node_id == node.id)
        .filter(SensorReadingProcessed.reading_timestamp <= raw_reading.reading_timestamp)
        .order_by(SensorReadingProcessed.reading_timestamp.desc())
        .limit(20)
        .all()
    )

    if not history:
        return 1, 0

    count = 0
    earliest_matching_timestamp = None

    for proc in history:
        historical_raw = proc.raw_reading
        if historical_raw is None:
            break

        evaluation = evaluate_all_fields(
            tilt_magnitude=historical_raw.tilt_magnitude,
            tilt_rate=proc.tilt_rate,
            displacement_mm=historical_raw.displacement_mm,
            displacement_rate_smoothed=proc.displacement_rate_smoothed,
            crack_width_mm=historical_raw.crack_width_mm,
            crack_growth_rate=proc.crack_growth_rate,
            crack_detected=historical_raw.crack_detected,
            vibration_energy=proc.vibration_energy,
            vibration_energy_rolling_baseline=None,
        )

        if evaluation["worst_level"] == candidate_level:
            count += 1
            earliest_matching_timestamp = historical_raw.reading_timestamp
        else:
            break

    seconds_elapsed = 0
    if earliest_matching_timestamp is not None:
        seconds_elapsed = int((raw_reading.reading_timestamp - earliest_matching_timestamp).total_seconds())

    return count, seconds_elapsed


def build_rule_triggered(worst_field: str, level: str) -> str:
    if worst_field is None:
        return thresholds.RULE_TRIGGERED_NORMAL
    return f"{worst_field}_{level.lower()}"


def build_confirmed_rule_triggered(confirmed_level: str, candidate_level: str, worst_field: str) -> str:
    if confirmed_level == "GREEN":
        return thresholds.RULE_TRIGGERED_NORMAL
    if confirmed_level == candidate_level and worst_field is not None:
        return f"{worst_field}_{confirmed_level.lower()}"
    return f"holding_at_{confirmed_level.lower()}"


def evaluate_risk(
    db: Session,
    node: SensorNode,
    raw_reading: SensorReadingRaw,
    processed_reading: SensorReadingProcessed,
    now: datetime = None,
) -> dict:
    if now is None:
        now = datetime.utcnow()

    health = evaluate_sensor_health(node, raw_reading, processed_reading, now)

    if health["is_grey"]:
        return {
            "zone_id": node.zone_id,
            "node_id": node.id,
            "evaluated_at": raw_reading.reading_timestamp,
            "risk_level": thresholds.RISK_LEVEL_GREY,
            "rule_triggered": health["rule_triggered"],
            "ml_risk_class": None,
            "ml_probability": None,
            "anomaly_score": None,
            "sensor_health_status": health["sensor_health_status"],
            "neighbor_agreement_count": 0,
            "persistence_seconds": 0,
            "data_quality_status": health["data_quality_status"],
            "recommended_action": RECOMMENDED_ACTION_BY_LEVEL["GREY"],
        }

    field_evaluation = evaluate_all_fields(
        tilt_magnitude=raw_reading.tilt_magnitude,
        tilt_rate=processed_reading.tilt_rate if processed_reading else None,
        displacement_mm=raw_reading.displacement_mm,
        displacement_rate_smoothed=processed_reading.displacement_rate_smoothed if processed_reading else None,
        crack_width_mm=raw_reading.crack_width_mm,
        crack_growth_rate=processed_reading.crack_growth_rate if processed_reading else None,
        crack_detected=raw_reading.crack_detected,
        vibration_energy=processed_reading.vibration_energy if processed_reading else None,
        vibration_energy_rolling_baseline=None,
    )

    candidate_level = field_evaluation["worst_level"]
    worst_field = field_evaluation["worst_field"]

    if health["sensor_health_status"] == thresholds.SENSOR_HEALTH_UNCALIBRATED and LEVEL_RANK[candidate_level] >= LEVEL_RANK["YELLOW"]:
        return {
            "zone_id": node.zone_id,
            "node_id": node.id,
            "evaluated_at": raw_reading.reading_timestamp,
            "risk_level": thresholds.RISK_LEVEL_GREY,
            "rule_triggered": thresholds.RULE_TRIGGERED_UNCALIBRATED_ELEVATED,
            "ml_risk_class": None,
            "ml_probability": None,
            "anomaly_score": None,
            "sensor_health_status": health["sensor_health_status"],
            "neighbor_agreement_count": 0,
            "persistence_seconds": 0,
            "data_quality_status": health["data_quality_status"],
            "recommended_action": RECOMMENDED_ACTION_BY_LEVEL["GREY"],
        }

    previous_risk = get_previous_risk_state(db, node)
    previous_confirmed_level = previous_risk.risk_level if previous_risk else None
    if previous_confirmed_level == thresholds.RISK_LEVEL_GREY:
        previous_confirmed_level = "GREEN"

    consecutive_count, seconds_in_state = get_consecutive_candidate_count(db, node, raw_reading, candidate_level)

    persistence_result = apply_persistence(
        candidate_level=candidate_level,
        previous_confirmed_level=previous_confirmed_level,
        consecutive_candidate_count=consecutive_count,
        seconds_in_candidate_state=seconds_in_state,
    )

    confirmed_level = persistence_result["confirmed_level"]

    neighbor_result = apply_neighbor_agreement(
        db=db,
        node=node,
        candidate_level=confirmed_level,
        reading_timestamp=raw_reading.reading_timestamp,
        data_quality_score=processed_reading.data_quality_score if processed_reading else None,
    )

    final_level = neighbor_result["adjusted_level"]

    if neighbor_result["rule_triggered"] is not None:
        rule_triggered = neighbor_result["rule_triggered"]
    else:
        rule_triggered = build_confirmed_rule_triggered(final_level, candidate_level, worst_field)

    return {
        "zone_id": node.zone_id,
        "node_id": node.id,
        "evaluated_at": raw_reading.reading_timestamp,
        "risk_level": final_level,
        "rule_triggered": rule_triggered,
        "ml_risk_class": None,
        "ml_probability": None,
        "anomaly_score": None,
        "sensor_health_status": health["sensor_health_status"],
        "neighbor_agreement_count": neighbor_result["neighbor_agreement_count"],
        "persistence_seconds": persistence_result["persistence_seconds"],
        "data_quality_status": health["data_quality_status"],
        "recommended_action": RECOMMENDED_ACTION_BY_LEVEL.get(final_level, RECOMMENDED_ACTION_BY_LEVEL["GREEN"]),
    }


def save_risk_evaluation(db: Session, result: dict) -> Risk:
    risk = Risk(**result)
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return risk
