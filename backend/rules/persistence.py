from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from models.sensor_models import SensorNode
from rules import thresholds


LEVEL_RANK = {
    "GREEN": 0,
    "YELLOW": 1,
    "ORANGE": 2,
    "RED": 3,
}

PERSISTENCE_READINGS_BY_LEVEL = {
    "YELLOW": thresholds.PERSISTENCE_READINGS_YELLOW,
    "ORANGE": thresholds.PERSISTENCE_READINGS_ORANGE,
    "RED": thresholds.PERSISTENCE_READINGS_RED,
}


def get_required_readings_for_escalation(candidate_level: str) -> int:
    return PERSISTENCE_READINGS_BY_LEVEL.get(candidate_level, 1)


def get_required_readings_for_deescalation(current_level: str) -> int:
    base = PERSISTENCE_READINGS_BY_LEVEL.get(current_level, 1)
    return base * thresholds.DEESCALATION_PERSISTENCE_MULTIPLIER


def apply_persistence(
    candidate_level: str,
    previous_confirmed_level: Optional[str],
    consecutive_candidate_count: int,
    seconds_in_candidate_state: int,
) -> dict:
    if previous_confirmed_level is None:
        previous_confirmed_level = "GREEN"

    if candidate_level == previous_confirmed_level:
        return {
            "confirmed_level": candidate_level,
            "persistence_seconds": seconds_in_candidate_state,
        }

    is_escalation = LEVEL_RANK[candidate_level] > LEVEL_RANK[previous_confirmed_level]

    if is_escalation:
        required = get_required_readings_for_escalation(candidate_level)
    else:
        required = get_required_readings_for_deescalation(previous_confirmed_level)

    if candidate_level == "RED":
        required = thresholds.PERSISTENCE_READINGS_RED

    if consecutive_candidate_count >= required:
        return {
            "confirmed_level": candidate_level,
            "persistence_seconds": seconds_in_candidate_state,
        }

    return {
        "confirmed_level": previous_confirmed_level,
        "persistence_seconds": seconds_in_candidate_state,
    }


def get_previous_risk_state(db: Session, node: SensorNode):
    from models.risk_models import Risk

    return (
        db.query(Risk)
        .filter(Risk.node_id == node.id)
        .order_by(Risk.evaluated_at.desc())
        .first()
    )
