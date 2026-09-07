import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.sync_models import SyncQueueEntry
from schemas.sync_schemas import (
    InternetToggleRequest,
    InternetToggleResponse,
    SyncStatusResponse,
    SyncTriggerResponse,
)
from sync.connectivity_service import is_internet_online, set_internet_status
from sync.sync_service import process_pending_sync_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/toggle-internet", response_model=InternetToggleResponse)
def toggle_internet(
    payload: InternetToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = set_internet_status(db, payload.online)
    logger.info("Internet toggled to online=%s by user_id=%s", payload.online, current_user.id)
    return InternetToggleResponse(internet_online=setting.setting_value.lower() == "true")


@router.get("/status", response_model=SyncStatusResponse)
def get_sync_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    online = is_internet_online(db)

    pending_count = db.query(SyncQueueEntry).filter_by(synchronization_status="pending").count()
    failed_count = db.query(SyncQueueEntry).filter_by(synchronization_status="failed").count()
    synced_count = db.query(SyncQueueEntry).filter_by(synchronization_status="synced").count()

    last_synced_entry = (
        db.query(SyncQueueEntry)
        .filter(SyncQueueEntry.synced_at.isnot(None))
        .order_by(SyncQueueEntry.synced_at.desc())
        .first()
    )
    last_synced_at = last_synced_entry.synced_at if last_synced_entry else None

    return SyncStatusResponse(
        internet_online=online,
        pending_count=pending_count,
        failed_count=failed_count,
        synced_count=synced_count,
        last_synced_at=last_synced_at,
    )


@router.post("/trigger", response_model=SyncTriggerResponse)
def trigger_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = process_pending_sync_queue(db)
    logger.info("Manual sync trigger by user_id=%s result=%s", current_user.id, result)
    return SyncTriggerResponse(**result)
