import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.session import get_db
from auth.api_key import verify_ingestion_api_key
from schemas.sensor_schemas import SensorReadingIngest, SensorReadingIngestResponse
from models.sensor_models import SensorReadingRaw, SensorReadingProcessed, SensorNode
from services.validation import validate_reading, normalize_timestamp
from services.feature_engineering import compute_features
from api.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])


@router.post("", response_model=SensorReadingIngestResponse)
async def ingest_reading(
    reading: SensorReadingIngest,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_ingestion_api_key),
):
    validation_result = validate_reading(db, reading)

    if not validation_result.is_valid:
        logger.warning("Ingestion rejected for node_id=%s reason=%s", reading.node_id, validation_result.reason)
        return SensorReadingIngestResponse(
            raw_reading_id=-1,
            processed_reading_id=None,
            data_quality_score=None,
            accepted=False,
            reason=validation_result.reason,
        )

    node = validation_result.node
    zone = validation_result.zone

    timestamp = normalize_timestamp(reading)

    raw_reading = SensorReadingRaw(
        node_id=node.id,
        zone_id=zone.id,
        reading_timestamp=timestamp,
        sequence_number=reading.sequence_number,
        data_source=reading.data_source,
        tilt_x=reading.tilt_x,
        tilt_y=reading.tilt_y,
        tilt_magnitude=reading.tilt_magnitude,
        displacement_mm=reading.displacement_mm,
        displacement_rate=reading.displacement_rate,
        vibration_rms=reading.vibration_rms,
        vibration_peak=reading.vibration_peak,
        vibration_variance=reading.vibration_variance,
        crack_width_mm=reading.crack_width_mm,
        crack_detected=reading.crack_detected,
        temperature=reading.temperature,
        humidity=reading.humidity,
        battery_voltage=reading.battery_voltage,
        rssi=reading.rssi,
        packet_loss=reading.packet_loss,
        sensor_status=reading.sensor_status,
        calibration_status=reading.calibration_status,
    )

    db.add(raw_reading)
    db.flush()

    features = compute_features(db, node, raw_reading)

    processed_reading = SensorReadingProcessed(
        raw_reading_id=raw_reading.id,
        node_id=node.id,
        zone_id=zone.id,
        reading_timestamp=timestamp,
        data_source=reading.data_source,
        tilt_rate=features["tilt_rate"],
        displacement_rate_smoothed=features["displacement_rate_smoothed"],
        crack_growth_rate=features["crack_growth_rate"],
        rolling_mean_displacement=features["rolling_mean_displacement"],
        rolling_std_displacement=features["rolling_std_displacement"],
        vibration_energy=features["vibration_energy"],
        neighbor_displacement_diff=features["neighbor_displacement_diff"],
        missing_packet_count=features["missing_packet_count"],
        battery_trend=features["battery_trend"],
        rssi_trend=features["rssi_trend"],
        data_quality_score=features["data_quality_score"],
    )

    db.add(processed_reading)

    node.last_seen_at = timestamp
    node.status = "online"
    if reading.calibration_status is not None:
        node.calibration_status = reading.calibration_status

    db.commit()
    db.refresh(raw_reading)
    db.refresh(processed_reading)

    logger.info(
        "Ingested reading node_id=%s raw_id=%s processed_id=%s quality=%s",
        reading.node_id,
        raw_reading.id,
        processed_reading.id,
        features["data_quality_score"],
    )

    await manager.broadcast({
        "type": "new_reading",
        "node_id": reading.node_id,
        "zone_id": reading.zone_id,
        "data_source": reading.data_source,
        "reading_timestamp": timestamp,
        "raw_reading_id": raw_reading.id,
        "processed_reading_id": processed_reading.id,
        "data_quality_score": features["data_quality_score"],
        "displacement_mm": raw_reading.displacement_mm,
        "sensor_status": raw_reading.sensor_status,
    })

    return SensorReadingIngestResponse(
        raw_reading_id=raw_reading.id,
        processed_reading_id=processed_reading.id,
        data_quality_score=features["data_quality_score"],
        accepted=True,
        reason=None,
    )
