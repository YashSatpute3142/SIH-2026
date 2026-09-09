from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.ml_output_models import Prediction
from models.sensor_models import SensorNode
from schemas.ml_output_schemas import PredictionOut

router = APIRouter(prefix="/api", tags=["predictions"])


@router.get("/predictions", response_model=List[PredictionOut])
def list_predictions(
    zone_id: Optional[int] = Query(default=None),
    trend_direction: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Prediction)

    if zone_id is not None:
        query = query.filter(Prediction.zone_id == zone_id)

    if trend_direction is not None:
        query = query.filter(Prediction.trend_direction == trend_direction.lower())

    return query.order_by(Prediction.predicted_at.desc()).limit(limit).all()


@router.get("/nodes/{node_id}/predictions/latest", response_model=PredictionOut)
def get_node_latest_prediction(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    prediction = (
        db.query(Prediction)
        .filter(Prediction.node_id == node.id)
        .order_by(Prediction.predicted_at.desc())
        .first()
    )

    if prediction is None:
        raise HTTPException(status_code=404, detail="No prediction found for this node")

    return prediction


@router.get("/nodes/{node_id}/predictions", response_model=List[PredictionOut])
def get_node_prediction_history(
    node_id: str,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    return (
        db.query(Prediction)
        .filter(Prediction.node_id == node.id)
        .order_by(Prediction.predicted_at.desc())
        .limit(limit)
        .all()
    )
