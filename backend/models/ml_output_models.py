from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Float,
    Integer,
    DateTime,
    JSON,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from database.base import Base


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    node_id = Column(BigInteger, ForeignKey("sensor_nodes.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    processed_reading_id = Column(BigInteger, ForeignKey("sensor_readings_processed.id", ondelete="SET NULL"))
    detected_at = Column(DateTime, nullable=False)
    anomaly_score = Column(Float, nullable=False)
    anomaly_status = Column(String(20), nullable=False)
    contributing_features = Column(JSON)
    model_version = Column(String(50))
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    node = relationship("SensorNode")
    zone = relationship("Zone")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    node_id = Column(BigInteger, ForeignKey("sensor_nodes.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    predicted_at = Column(DateTime, nullable=False)
    horizon_hours = Column(Integer, nullable=False)
    predicted_displacement_mm = Column(Float, nullable=False)
    trend_direction = Column(String(20))
    confidence = Column(Float)
    model_name = Column(String(100))
    model_version = Column(String(50))
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    node = relationship("SensorNode")
    zone = relationship("Zone")
