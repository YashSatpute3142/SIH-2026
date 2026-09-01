from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.sensor_models import SensorNode, Zone, SensorReadingRaw, SensorReadingProcessed
from schemas.sensor_schemas import (
    SensorNodeOut,
    ZoneOut,
    SensorReadingRawOut,
    SensorReadingProcessedOut,
)

router = APIRouter(prefix="/api", tags=["reads"])


@router.get("/zones", response_model=List[ZoneOut])
def list_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Zone).all()


@router.get("/nodes", response_model=List[SensorNodeOut])
def list_nodes(
    zone_id: Optional[int] = Query(default=None),
    data_source: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SensorNode)

    if zone_id is not None:
        query = query.filter(SensorNode.zone_id == zone_id)

    if data_source is not None:
        query = query.filter(SensorNode.data_source == data_source)

    return query.all()


@router.get("/nodes/{node_id}", response_model=SensorNodeOut)
def get_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()

    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")

    return node


@router.get("/nodes/{node_id}/readings/raw", response_model=List[SensorReadingRawOut])
def get_node_raw_readings(
    node_id: str,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()

    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")

    return (
        db.query(SensorReadingRaw)
        .filter(SensorReadingRaw.node_id == node.id)
        .order_by(SensorReadingRaw.reading_timestamp.desc())
        .limit(limit)
        .all()
    )


@router.get("/nodes/{node_id}/readings/processed", response_model=List[SensorReadingProcessedOut])
def get_node_processed_readings(
    node_id: str,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()

    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")

    return (
        db.query(SensorReadingProcessed)
        .filter(SensorReadingProcessed.node_id == node.id)
        .order_by(SensorReadingProcessed.reading_timestamp.desc())
        .limit(limit)
        .all()
    )


@router.get("/nodes/{node_id}/readings/latest", response_model=SensorReadingProcessedOut)
def get_node_latest_reading(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()

    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")

    latest = (
        db.query(SensorReadingProcessed)
        .filter(SensorReadingProcessed.node_id == node.id)
        .order_by(SensorReadingProcessed.reading_timestamp.desc())
        .first()
    )

    if latest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No readings for this node yet")

    return latest


@router.get("/zones/{zone_code}/readings/latest", response_model=List[SensorReadingProcessedOut])
def get_zone_latest_readings(
    zone_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.zone_code == zone_code).one_or_none()

    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    nodes = db.query(SensorNode).filter(SensorNode.zone_id == zone.id).all()

    results = []
    for node in nodes:
        latest = (
            db.query(SensorReadingProcessed)
            .filter(SensorReadingProcessed.node_id == node.id)
            .order_by(SensorReadingProcessed.reading_timestamp.desc())
            .first()
        )
        if latest is not None:
            results.append(latest)

    return results
