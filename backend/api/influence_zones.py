from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.sensor_models import SensorNode
from models.risk_models import Risk
from schemas.influence_zone_schemas import InfluenceZoneOut
from services.influence_zone import build_influence_zone

router = APIRouter(prefix="/api", tags=["influence-zones"])


def _latest_risk_for_node(db: Session, node_id: int):
    return (
        db.query(Risk)
        .filter(Risk.node_id == node_id)
        .order_by(Risk.evaluated_at.desc())
        .first()
    )


@router.get("/nodes/{node_id}/influence-zone", response_model=InfluenceZoneOut)
def get_node_influence_zone(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    risk = _latest_risk_for_node(db, node.id)
    if risk is None:
        raise HTTPException(status_code=404, detail="No risk evaluation found for this node")

    zone = build_influence_zone(node, risk)
    if zone is None:
        raise HTTPException(
            status_code=404,
            detail="No influence zone available for this node's current risk level",
        )

    return zone


@router.get("/influence-zones", response_model=List[InfluenceZoneOut])
def list_influence_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    nodes = db.query(SensorNode).filter(SensorNode.status != "decommissioned").all()

    zones = []
    for node in nodes:
        risk = _latest_risk_for_node(db, node.id)
        if risk is None:
            continue

        zone = build_influence_zone(node, risk)
        if zone is not None:
            zones.append(zone)

    return zones
