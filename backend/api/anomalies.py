from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.ml_output_models import Anomaly
from models.sensor_models import SensorNode
from schemas.ml_output_schemas import AnomalyOut

router = APIRouter(prefix="/api", tags=["anomalies"])


@router.get("/anomalies", response_model=List[AnomalyOut])
def list_anomalies(
    zone_id: Optional[int] = Query(default=None),
    anomaly_status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Anomaly)

    if zone_id is not None:
        query = query.filter(Anomaly.zone_id == zone_id)

    if anomaly_status is not None:
        query = query.filter(Anomaly.anomaly_status == anomaly_status.lower())

    return query.order_by(Anomaly.detected_at.desc()).limit(limit).all()


@router.get("/nodes/{node_id}/anomalies/latest", response_model=AnomalyOut)
def get_node_latest_anomaly(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    anomaly = (
        db.query(Anomaly)
        .filter(Anomaly.node_id == node.id)
        .order_by(Anomaly.detected_at.desc())
        .first()
    )

    if anomaly is None:
        raise HTTPException(status_code=404, detail="No anomaly evaluation found for this node")

    return anomaly


@router.get("/nodes/{node_id}/anomalies", response_model=List[AnomalyOut])
def get_node_anomaly_history(
    node_id: str,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    return (
        db.query(Anomaly)
        .filter(Anomaly.node_id == node.id)
        .order_by(Anomaly.detected_at.desc())
        .limit(limit)
        .all()
    )
