from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field


SensorType = Literal[
    "tilt",
    "displacement",
    "vibration",
    "crack",
    "temperature",
    "humidity",
    "battery",
    "rssi",
]


class SensorReadingIngest(BaseModel):
    node_id: str
    zone_id: str
    reading_timestamp: Optional[datetime] = None
    sequence_number: Optional[int] = None
    data_source: Literal["real", "simulated"]
    tilt_x: Optional[float] = None
    tilt_y: Optional[float] = None
    tilt_magnitude: Optional[float] = None
    displacement_mm: Optional[float] = None
    displacement_rate: Optional[float] = None
    vibration_rms: Optional[float] = None
    vibration_peak: Optional[float] = None
    vibration_variance: Optional[float] = None
    crack_width_mm: Optional[float] = None
    crack_detected: Optional[bool] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    battery_voltage: Optional[float] = None
    rssi: Optional[int] = None
    packet_loss: Optional[float] = None
    sensor_status: Optional[str] = None
    calibration_status: Optional[str] = None


class SensorReadingIngestResponse(BaseModel):
    raw_reading_id: int
    processed_reading_id: Optional[int] = None
    data_quality_score: Optional[float] = None
    accepted: bool
    reason: Optional[str] = None


class SensorReadingRawOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    zone_id: int
    reading_timestamp: datetime
    sequence_number: Optional[int] = None
    data_source: Literal["real", "simulated"]
    tilt_x: Optional[float] = None
    tilt_y: Optional[float] = None
    tilt_magnitude: Optional[float] = None
    displacement_mm: Optional[float] = None
    displacement_rate: Optional[float] = None
    vibration_rms: Optional[float] = None
    vibration_peak: Optional[float] = None
    vibration_variance: Optional[float] = None
    crack_width_mm: Optional[float] = None
    crack_detected: Optional[bool] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    battery_voltage: Optional[float] = None
    rssi: Optional[int] = None
    packet_loss: Optional[float] = None
    sensor_status: Optional[str] = None
    calibration_status: Optional[str] = None
    ingested_at: datetime


class SensorReadingProcessedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    raw_reading_id: int
    node_id: int
    zone_id: int
    reading_timestamp: datetime
    data_source: Literal["real", "simulated"]
    tilt_rate: Optional[float] = None
    displacement_rate_smoothed: Optional[float] = None
    crack_growth_rate: Optional[float] = None
    rolling_mean_displacement: Optional[float] = None
    rolling_std_displacement: Optional[float] = None
    vibration_energy: Optional[float] = None
    neighbor_displacement_diff: Optional[float] = None
    missing_packet_count: int
    battery_trend: Optional[float] = None
    rssi_trend: Optional[float] = None
    data_quality_score: Optional[float] = None
    processed_at: datetime


class ZoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_code: str
    name: str
    panel_id: Optional[int] = None


class SensorNodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: str
    node_name: Optional[str] = None
    zone_id: int
    data_source: Literal["real", "simulated"]
    sensor_types: Optional[List[SensorType]] = None
    latitude: float
    longitude: float
    is_reference_node: bool
    calibration_status: str
    last_seen_at: Optional[datetime] = None
    status: str


class NodeCreate(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=50)
    node_name: Optional[str] = Field(default=None, max_length=255)
    zone_id: int
    data_source: Literal["real", "simulated"]
    sensor_types: Optional[List[SensorType]] = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    is_reference_node: bool = False
    calibration_status: str = "unknown"


class NodeUpdate(BaseModel):
    node_name: Optional[str] = Field(default=None, max_length=255)
    zone_id: Optional[int] = None
    sensor_types: Optional[List[SensorType]] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    is_reference_node: Optional[bool] = None
    calibration_status: Optional[str] = None
    status: Optional[str] = None
