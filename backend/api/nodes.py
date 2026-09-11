from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import require_role
from models.user import User
from models.sensor_models import SensorNode, Zone
from schemas.sensor_schemas import SensorNodeOut, NodeCreate, NodeUpdate

router = APIRouter(prefix="/api", tags=["nodes"])


@router.post("/nodes", response_model=SensorNodeOut, status_code=201)
def create_node(
    payload: NodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    existing = db.query(SensorNode).filter(SensorNode.node_id == payload.node_id).one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"node_id '{payload.node_id}' is already registered")

    zone = db.query(Zone).filter(Zone.id == payload.zone_id).one_or_none()
    if zone is None:
        raise HTTPException(status_code=404, detail=f"zone_id {payload.zone_id} not found")

    node = SensorNode(
        node_id=payload.node_id,
        node_name=payload.node_name,
        zone_id=payload.zone_id,
        data_source=payload.data_source,
        sensor_types=payload.sensor_types,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_reference_node=payload.is_reference_node,
        calibration_status=payload.calibration_status,
        status="offline",
    )

    db.add(node)
    db.commit()
    db.refresh(node)

    return node


@router.patch("/nodes/{node_id}", response_model=SensorNodeOut)
def update_node(
    node_id: str,
    payload: NodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    updates = payload.model_dump(exclude_unset=True)

    if "zone_id" in updates:
        zone = db.query(Zone).filter(Zone.id == updates["zone_id"]).one_or_none()
        if zone is None:
            raise HTTPException(status_code=404, detail=f"zone_id {updates['zone_id']} not found")

    for field_name, value in updates.items():
        setattr(node, field_name, value)

    db.commit()
    db.refresh(node)

    return node


@router.delete("/nodes/{node_id}", response_model=SensorNodeOut)
def deregister_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    if node.status == "decommissioned":
        raise HTTPException(status_code=400, detail="Node is already decommissioned")

    node.status = "decommissioned"

    db.commit()
    db.refresh(node)

    return node
