from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user
from models.risk_models import Risk
from models.sensor_models import SensorNode, Zone
from schemas.risk_schemas import RiskOut
from rules.field_thresholds import LEVEL_RANK

router = APIRouter(prefix="/api", tags=["risks"])

RISK_LEVEL_RANK_WITH_GREY = {
    "GREEN": 0,
    "YELLOW": 1,
    "GREY": 1,
    "ORANGE": 2,
    "RED": 3,
}


@router.get("/risks", response_model=List[RiskOut])
def list_risks(
    zone_id: Optional[int] = Query(None),
    node_id: Optional[int] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Risk)

    if zone_id is not None:
        query = query.filter(Risk.zone_id == zone_id)
    if node_id is not None:
        query = query.filter(Risk.node_id == node_id)
    if risk_level is not None:
        query = query.filter(Risk.risk_level == risk_level.upper())

    return query.order_by(Risk.evaluated_at.desc()).limit(limit).all()


@router.get("/nodes/{node_id}/risk/latest", response_model=RiskOut)
def get_node_latest_risk(
    node_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    risk = (
        db.query(Risk)
        .filter(Risk.node_id == node.id)
        .order_by(Risk.evaluated_at.desc())
        .first()
    )

    if risk is None:
        raise HTTPException(status_code=404, detail="No risk evaluation found for this node")

    return risk


@router.get("/nodes/{node_id}/risk/history", response_model=List[RiskOut])
def get_node_risk_history(
    node_id: str,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    return (
        db.query(Risk)
        .filter(Risk.node_id == node.id)
        .order_by(Risk.evaluated_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/zones/{zone_code}/risk/latest")
def get_zone_latest_risk(
    zone_code: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.zone_code == zone_code).first()
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    nodes = db.query(SensorNode).filter(SensorNode.zone_id == zone.id).all()
    if not nodes:
        raise HTTPException(status_code=404, detail="No nodes registered in this zone")

    worst_risk = None
    node_risks = []

    for node in nodes:
        latest = (
            db.query(Risk)
            .filter(Risk.node_id == node.id)
            .order_by(Risk.evaluated_at.desc())
            .first()
        )
        if latest is None:
            continue

        node_risks.append(latest)

        if worst_risk is None:
            worst_risk = latest
            continue

        current_rank = RISK_LEVEL_RANK_WITH_GREY.get(latest.risk_level, 0)
        worst_rank = RISK_LEVEL_RANK_WITH_GREY.get(worst_risk.risk_level, 0)
        if current_rank > worst_rank:
            worst_risk = latest

    if worst_risk is None:
        raise HTTPException(status_code=404, detail="No risk evaluations found for this zone")

    return {
        "zone_id": zone.id,
        "zone_code": zone.zone_code,
        "zone_risk_level": worst_risk.risk_level,
        "worst_node_id": worst_risk.node_id,
        "evaluated_at": worst_risk.evaluated_at,
        "node_count": len(nodes),
        "node_risks_evaluated": len(node_risks),
    }
