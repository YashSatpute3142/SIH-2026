from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Float,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from database.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    risk_id = Column(BigInteger, ForeignKey("risks.id", ondelete="SET NULL"))
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    alert_level = Column(String(20), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    affected_nodes = Column(JSON)
    triggering_measurements = Column(JSON)
    model_probability = Column(Float)
    anomaly_score = Column(Float)
    data_quality_status = Column(String(50))
    recommended_action = Column(Text)
    status = Column(String(20), nullable=False, default="active")
    synchronization_status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    resolved_at = Column(DateTime)

    risk = relationship("Risk")
    zone = relationship("Zone")
    acknowledgements = relationship("AlertAcknowledgement", back_populates="alert")


class AlertAcknowledgement(Base):
    __tablename__ = "alert_acknowledgements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    alert_id = Column(BigInteger, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    acknowledged_by = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    acknowledged_at = Column(DateTime, nullable=False, server_default=func.now())
    notes = Column(Text)

    alert = relationship("Alert", back_populates="acknowledgements")
    user = relationship("User")
