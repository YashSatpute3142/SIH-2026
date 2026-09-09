from datetime import datetime
from typing import Optional, Literal, Dict
from pydantic import BaseModel, ConfigDict


RiskLevel = Literal["GREEN", "YELLOW", "ORANGE", "RED", "GREY"]

SensorHealthStatus = Literal["healthy", "degraded", "offline", "uncalibrated"]

DataQualityStatus = Literal["good", "fair", "poor"]


class RiskEvaluationResult(BaseModel):
    zone_id: int
    node_id: Optional[int] = None
    evaluated_at: datetime
    risk_level: RiskLevel
    rule_triggered: str
    ml_risk_class: Optional[str] = None
    ml_probability: Optional[float] = None
    anomaly_score: Optional[float] = None
    contributing_features: Optional[Dict[str, float]] = None
    sensor_health_status: SensorHealthStatus
    neighbor_agreement_count: int = 0
    persistence_seconds: int = 0
    data_quality_status: DataQualityStatus
    recommended_action: str


class RiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: int
    node_id: Optional[int] = None
    evaluated_at: datetime
    risk_level: RiskLevel
    rule_triggered: Optional[str] = None
    ml_risk_class: Optional[str] = None
    ml_probability: Optional[float] = None
    anomaly_score: Optional[float] = None
    contributing_features: Optional[Dict[str, float]] = None
    sensor_health_status: Optional[str] = None
    neighbor_agreement_count: int
    persistence_seconds: int
    data_quality_status: Optional[str] = None
    recommended_action: Optional[str] = None
    created_at: datetime
