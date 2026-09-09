from datetime import datetime
from typing import Optional, Dict, Literal
from pydantic import BaseModel, ConfigDict


AnomalyStatus = Literal["anomaly", "normal"]

TrendDirection = Literal["rising", "falling", "stable", "unknown"]


class AnomalyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    zone_id: int
    processed_reading_id: Optional[int] = None
    detected_at: datetime
    anomaly_score: float
    anomaly_status: AnomalyStatus
    contributing_features: Optional[Dict[str, float]] = None
    model_version: Optional[str] = None
    created_at: datetime


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    zone_id: int
    predicted_at: datetime
    horizon_hours: int
    predicted_displacement_mm: float
    trend_direction: Optional[TrendDirection] = None
    confidence: Optional[float] = None
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    created_at: datetime
