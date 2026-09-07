from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Integer,
    DateTime,
    JSON,
    func,
)

from database.base import Base


class SyncQueueEntry(Base):
    __tablename__ = "sync_queue"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(BigInteger, nullable=False)
    payload = Column(JSON, nullable=False)
    synchronization_status = Column(String(20), nullable=False, default="pending")
    retry_count = Column(Integer, nullable=False, default=0)
    last_attempt_at = Column(DateTime)
    synced_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
