from datetime import datetime
from sqlalchemy.orm import Session

from models.sensor_models import SensorNode, SensorReadingProcessed
from rules import thresholds
from rules.field_thresholds import evaluate_all_fields, LEVEL_RANK


def get_zone_neighbors(db: Session, node: SensorNode):
    return (
        db.query(SensorNode)
        .filter(SensorNode.zone_id == node.zone_id)
        .filter(SensorNode.id != node.id)
        .filter(SensorNode.is_reference_node == False)
        .all()
    )


def get_latest_processed_reading(db: Session, node_id: int, before_timestamp: datetime):
    return (
        db.query(SensorReadingProcessed)
        .filter(SensorReadingProcessed.node_id == node_id)
        .filter(SensorReadingProcessed.reading_timestamp <= before_timestamp)
        .order_by(SensorReadingProcessed.reading_timestamp.desc())
        .first()
    )


def count_neighbors_at_or_above_yellow(db: Session, node: SensorNode, reading_timestamp: datetime) -> int:
    neighbors = get_zone_neighbors(db, node)
    count = 0

    for neighbor in neighbors:
        latest = get_latest_processed_reading(db, neighbor.id, reading_timestamp)
        if latest is None:
            continue

        raw = latest.raw_reading if hasattr(latest, "raw_reading") else None
        if raw is None:
            continue

        evaluation = evaluate_all_fields(
            tilt_magnitude=raw.tilt_magnitude,
            tilt_rate=latest.tilt_rate,
            displacement_mm=raw.displacement_mm,
            displacement_rate_smoothed=latest.displacement_rate_smoothed,
            crack_width_mm=raw.crack_width_mm,
            crack_growth_rate=latest.crack_growth_rate,
            crack_detected=raw.crack_detected,
            vibration_energy=latest.vibration_energy,
            vibration_energy_rolling_baseline=None,
        )

        if LEVEL_RANK[evaluation["worst_level"]] >= LEVEL_RANK["YELLOW"]:
            count += 1

    return count


def apply_neighbor_agreement(
    db: Session,
    node: SensorNode,
    candidate_level: str,
    reading_timestamp: datetime,
    data_quality_score: float,
) -> dict:
    if LEVEL_RANK[candidate_level] < LEVEL_RANK["ORANGE"]:
        neighbor_count = count_neighbors_at_or_above_yellow(db, node, reading_timestamp)
        return {
            "adjusted_level": candidate_level,
            "neighbor_agreement_count": neighbor_count,
            "rule_triggered": None,
        }

    neighbor_count = count_neighbors_at_or_above_yellow(db, node, reading_timestamp)

    if neighbor_count == 0 and (data_quality_score is None or data_quality_score >= thresholds.DATA_QUALITY_SCORE_GOOD_THRESHOLD):
        downgraded_level = _downgrade_one_level(candidate_level)
        return {
            "adjusted_level": downgraded_level,
            "neighbor_agreement_count": neighbor_count,
            "rule_triggered": thresholds.RULE_TRIGGERED_UNCONFIRMED_SINGLE_SENSOR,
        }

    return {
        "adjusted_level": candidate_level,
        "neighbor_agreement_count": neighbor_count,
        "rule_triggered": None,
    }


def _downgrade_one_level(level: str) -> str:
    order = thresholds.RISK_LEVELS_ORDER
    idx = order.index(level)
    if idx == 0:
        return level
    return order[idx - 1]
