from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Float,
    Integer,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from database.base import Base


class Risk(Base):
    __tablename__ = "risks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    node_id = Column(BigInteger, ForeignKey("sensor_nodes.id", ondelete="SET NULL"))
    evaluated_at = Column(DateTime, nullable=False)
    risk_level = Column(String(20), nullable=False)
    rule_triggered = Column(String(255))
    ml_risk_class = Column(String(20))
    ml_probability = Column(Float)
    anomaly_score = Column(Float)
    contributing_features = Column(JSON)
    sensor_health_status = Column(String(50))
    neighbor_agreement_count = Column(Integer, default=0)
    persistence_seconds = Column(Integer, default=0)
    data_quality_status = Column(String(50))
    recommended_action = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    zone = relationship("Zone")
    node = relationship("SensorNode")
