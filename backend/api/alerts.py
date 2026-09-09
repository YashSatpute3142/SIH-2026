from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone

from database.session import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.alert_models import Alert, AlertAcknowledgement
from models.sensor_models import Zone
from schemas.alert_schemas import (
    AlertOut,
    AlertWithAcknowledgementsOut,
    AlertAcknowledgeRequest,
    AlertAcknowledgementOut,
)

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts", response_model=List[AlertOut])
def list_alerts(
    zone_id: Optional[int] = Query(default=None),
    alert_level: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)

    if zone_id is not None:
        query = query.filter(Alert.zone_id == zone_id)

    if alert_level is not None:
        query = query.filter(Alert.alert_level == alert_level.upper())

    if status is not None:
        query = query.filter(Alert.status == status.lower())

    return query.order_by(Alert.created_at.desc()).limit(limit).all()


@router.get("/alerts/{alert_id}", response_model=AlertWithAcknowledgementsOut)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = (
        db.query(Alert)
        .options(joinedload(Alert.acknowledgements))
        .filter(Alert.id == alert_id)
        .one_or_none()
    )

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.get("/zones/{zone_code}/alerts", response_model=List[AlertOut])
def get_zone_alerts(
    zone_code: str,
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.zone_code == zone_code).one_or_none()

    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    query = db.query(Alert).filter(Alert.zone_id == zone.id)

    if status is not None:
        query = query.filter(Alert.status == status.lower())

    return query.order_by(Alert.created_at.desc()).limit(limit).all()


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertAcknowledgementOut)
def acknowledge_alert(
    alert_id: int,
    payload: AlertAcknowledgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).one_or_none()

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status == "resolved":
        raise HTTPException(status_code=400, detail="Cannot acknowledge a resolved alert")

    ack = AlertAcknowledgement(
        alert_id=alert.id,
        acknowledged_by=current_user.id,
        notes=payload.notes,
    )
    db.add(ack)

    if alert.status == "active":
        alert.status = "acknowledged"

    db.commit()
    db.refresh(ack)

    return ack


@router.post("/alerts/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).one_or_none()

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status == "resolved":
        raise HTTPException(status_code=400, detail="Alert is already resolved")

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    return alert
