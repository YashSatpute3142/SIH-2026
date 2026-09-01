from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Float,
    Boolean,
    DateTime,
    Integer,
    JSON,
    ForeignKey,
    Enum,
    func,
)
from sqlalchemy.orm import relationship

from database.base import Base


class MinePanel(Base):
    __tablename__ = "mine_panels"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    panel_code = Column(String(50), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    depth_m = Column(Float)
    boundary_geojson = Column(JSON)
    status = Column(String(50), nullable=False, default="active")
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    zones = relationship("Zone", back_populates="panel")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    zone_code = Column(String(10), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    panel_id = Column(BigInteger, ForeignKey("mine_panels.id", ondelete="SET NULL"))
    boundary_geojson = Column(JSON)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    panel = relationship("MinePanel", back_populates="zones")
    nodes = relationship("SensorNode", back_populates="zone")


class SensorNode(Base):
    __tablename__ = "sensor_nodes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    node_id = Column(String(50), nullable=False, unique=True)
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    data_source = Column(Enum("real", "simulated", name="data_source_enum"), nullable=False, default="simulated")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_reference_node = Column(Boolean, nullable=False, default=False)
    calibration_status = Column(String(50), nullable=False, default="unknown")
    installed_at = Column(DateTime)
    last_seen_at = Column(DateTime)
    status = Column(String(50), nullable=False, default="offline")
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    zone = relationship("Zone", back_populates="nodes")
    raw_readings = relationship("SensorReadingRaw", back_populates="node")
    processed_readings = relationship("SensorReadingProcessed", back_populates="node")


class SensorReadingRaw(Base):
    __tablename__ = "sensor_readings_raw"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    node_id = Column(BigInteger, ForeignKey("sensor_nodes.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    reading_timestamp = Column(DateTime, nullable=False)
    sequence_number = Column(BigInteger)
    data_source = Column(Enum("real", "simulated", name="data_source_enum_raw"), nullable=False)
    tilt_x = Column(Float)
    tilt_y = Column(Float)
    tilt_magnitude = Column(Float)
    displacement_mm = Column(Float)
    displacement_rate = Column(Float)
    vibration_rms = Column(Float)
    vibration_peak = Column(Float)
    vibration_variance = Column(Float)
    crack_width_mm = Column(Float)
    crack_detected = Column(Boolean)
    temperature = Column(Float)
    humidity = Column(Float)
    battery_voltage = Column(Float)
    rssi = Column(Integer)
    packet_loss = Column(Float)
    sensor_status = Column(String(50))
    calibration_status = Column(String(50))
    ingested_at = Column(DateTime, nullable=False, server_default=func.now())

    node = relationship("SensorNode", back_populates="raw_readings")
    processed = relationship("SensorReadingProcessed", back_populates="raw_reading", uselist=False)


class SensorReadingProcessed(Base):
    __tablename__ = "sensor_readings_processed"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    raw_reading_id = Column(BigInteger, ForeignKey("sensor_readings_raw.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(BigInteger, ForeignKey("sensor_nodes.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(BigInteger, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    reading_timestamp = Column(DateTime, nullable=False)
    data_source = Column(Enum("real", "simulated", name="data_source_enum_processed"), nullable=False)
    tilt_rate = Column(Float)
    displacement_rate_smoothed = Column(Float)
    crack_growth_rate = Column(Float)
    rolling_mean_displacement = Column(Float)
    rolling_std_displacement = Column(Float)
    vibration_energy = Column(Float)
    neighbor_displacement_diff = Column(Float)
    missing_packet_count = Column(Integer, default=0)
    battery_trend = Column(Float)
    rssi_trend = Column(Float)
    data_quality_score = Column(Float)
    processed_at = Column(DateTime, nullable=False, server_default=func.now())

    raw_reading = relationship("SensorReadingRaw", back_populates="processed")
    node = relationship("SensorNode", back_populates="processed_readings")
