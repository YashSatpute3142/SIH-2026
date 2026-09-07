from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class InternetToggleRequest(BaseModel):
    online: bool


class InternetToggleResponse(BaseModel):
    internet_online: bool


class SyncStatusResponse(BaseModel):
    internet_online: bool
    pending_count: int
    failed_count: int
    synced_count: int
    last_synced_at: Optional[datetime] = None


class SyncTriggerResponse(BaseModel):
    total_processed: int
    synced: int
    failed_or_retrying: int
    skipped_offline: bool = False
