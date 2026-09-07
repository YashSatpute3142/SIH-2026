import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models.sync_models import SyncQueueEntry
from sync.firebase_client import get_firestore_client
from sync.connectivity_service import is_internet_online

logger = logging.getLogger(__name__)

MAX_RETRY_COUNT = 5


def enqueue_for_sync(db: Session, entity_type: str, entity_id: int, payload: dict) -> SyncQueueEntry:
    entry = SyncQueueEntry(
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
        synchronization_status="pending",
        retry_count=0,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    logger.info(
        "Enqueued for sync entity_type=%s entity_id=%s sync_id=%s",
        entity_type, entity_id, entry.id,
    )
    return entry


def _firestore_collection_for(entity_type: str) -> str:
    return f"{entity_type}_sync"


def _push_entry(db: Session, entry: SyncQueueEntry) -> bool:
    now = datetime.now(timezone.utc)

    try:
        firestore_client = get_firestore_client()
        collection_name = _firestore_collection_for(entry.entity_type)
        doc_id = f"{entry.entity_type}_{entry.entity_id}"
        doc_ref = firestore_client.collection(collection_name).document(doc_id)
        doc_ref.set(entry.payload, merge=True)

        entry.synchronization_status = "synced"
        entry.synced_at = now
        entry.last_attempt_at = now
        db.commit()

        logger.info(
            "Synced entity_type=%s entity_id=%s sync_id=%s to Firestore collection=%s doc_id=%s",
            entry.entity_type, entry.entity_id, entry.id, collection_name, doc_id,
        )
        return True

    except Exception as exc:
        entry.retry_count += 1
        entry.last_attempt_at = now

        if entry.retry_count >= MAX_RETRY_COUNT:
            entry.synchronization_status = "failed"
            logger.error(
                "Sync permanently failed after %s retries entity_type=%s entity_id=%s sync_id=%s error=%s",
                entry.retry_count, entry.entity_type, entry.entity_id, entry.id, exc,
            )
        else:
            entry.synchronization_status = "pending"
            logger.warning(
                "Sync attempt failed (retry %s/%s) entity_type=%s entity_id=%s sync_id=%s error=%s",
                entry.retry_count, MAX_RETRY_COUNT, entry.entity_type, entry.entity_id, entry.id, exc,
            )

        db.commit()
        return False


def process_pending_sync_queue(db: Session, batch_size: int = 50) -> dict:
    if not is_internet_online(db):
        logger.info("Internet marked offline, skipping sync push cycle")
        return {
            "total_processed": 0,
            "synced": 0,
            "failed_or_retrying": 0,
            "skipped_offline": True,
        }

    pending_entries = (
        db.query(SyncQueueEntry)
        .filter(SyncQueueEntry.synchronization_status == "pending")
        .order_by(SyncQueueEntry.created_at.asc())
        .limit(batch_size)
        .all()
    )

    synced_count = 0
    failed_or_retrying_count = 0

    for entry in pending_entries:
        if _push_entry(db, entry):
            synced_count += 1
        else:
            failed_or_retrying_count += 1

    logger.info(
        "Sync batch complete total=%s synced=%s failed_or_retrying=%s",
        len(pending_entries), synced_count, failed_or_retrying_count,
    )

    return {
        "total_processed": len(pending_entries),
        "synced": synced_count,
        "failed_or_retrying": failed_or_retrying_count,
    }
