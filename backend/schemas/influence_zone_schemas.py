from typing import Optional
from pydantic import BaseModel


class InfluenceZoneCenter(BaseModel):
    lat: float
    lon: float


class InfluenceZoneBasis(BaseModel):
    persistence_seconds: int
    neighbor_agreement_count: int
    risk_level: str


class InfluenceZoneOut(BaseModel):
    node_id: str
    center: InfluenceZoneCenter
    radius_m: float
    risk_level: str
    basis: InfluenceZoneBasis
