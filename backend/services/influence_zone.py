from typing import Optional

from models.sensor_models import SensorNode
from models.risk_models import Risk

BASE_RADIUS_M = 1000.0

RISK_MULTIPLIER = {
    "GREEN": 1.0,
    "YELLOW": 1.6,
    "ORANGE": 2.5,
    "RED": 4.0,
}

PERSISTENCE_FACTOR_CAP = 2.0
PERSISTENCE_SECONDS_SCALE = 3600.0

AGREEMENT_FACTOR_CAP = 1.6
AGREEMENT_FACTOR_PER_NEIGHBOR = 0.15


def compute_radius_m(risk_level: str, persistence_seconds: int, neighbor_agreement_count: int) -> Optional[float]:
    """
    Returns an estimated influence-zone radius in meters, or None if no zone
    should be drawn (GREY = missing/insufficient data, not evidence of risk).
    """
    risk_multiplier = RISK_MULTIPLIER.get(risk_level)
    if risk_multiplier is None:
        return None

    persistence_factor = min(1 + (persistence_seconds or 0) / PERSISTENCE_SECONDS_SCALE, PERSISTENCE_FACTOR_CAP)
    agreement_factor = min(1 + AGREEMENT_FACTOR_PER_NEIGHBOR * (neighbor_agreement_count or 0), AGREEMENT_FACTOR_CAP)

    return BASE_RADIUS_M * risk_multiplier * persistence_factor * agreement_factor


def build_influence_zone(node: SensorNode, risk: Risk) -> Optional[dict]:
    """
    Builds the influence-zone response dict for one node's latest risk evaluation.
    Returns None if risk_level is GREY or otherwise not eligible for a zone.
    """
    radius_m = compute_radius_m(
        risk_level=risk.risk_level,
        persistence_seconds=risk.persistence_seconds,
        neighbor_agreement_count=risk.neighbor_agreement_count,
    )

    if radius_m is None:
        return None

    return {
        "node_id": node.node_id,
        "center": {"lat": node.latitude, "lon": node.longitude},
        "radius_m": round(radius_m, 1),
        "risk_level": risk.risk_level,
        "basis": {
            "persistence_seconds": risk.persistence_seconds,
            "neighbor_agreement_count": risk.neighbor_agreement_count,
            "risk_level": risk.risk_level,
        },
    }
