from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict


AlertLevel = Literal["GREEN", "YELLOW", "ORANGE", "RED", "GREY"]

AlertStatus = Literal["active", "acknowledged", "resolved"]

AlertSyncStatus = Literal["pending", "synced", "failed"]


class AlertAcknowledgementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_id: int
    acknowledged_by: int
    acknowledged_at: datetime
    notes: Optional[str] = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    risk_id: Optional[int] = None
    zone_id: int
    alert_level: AlertLevel
    title: str
    message: Optional[str] = None
    affected_nodes: Optional[list] = None
    triggering_measurements: Optional[dict] = None
    model_probability: Optional[float] = None
    anomaly_score: Optional[float] = None
    data_quality_status: Optional[str] = None
    recommended_action: Optional[str] = None
    status: AlertStatus
    synchronization_status: AlertSyncStatus
    created_at: datetime
    resolved_at: Optional[datetime] = None


class AlertWithAcknowledgementsOut(AlertOut):
    acknowledgements: List[AlertAcknowledgementOut] = []


class AlertAcknowledgeRequest(BaseModel):
    notes: Optional[str] = None
