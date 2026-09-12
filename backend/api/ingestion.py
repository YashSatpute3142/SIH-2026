import logging
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from auth.api_key import verify_ingestion_api_key
from schemas.sensor_schemas import SensorReadingIngest, SensorReadingIngestResponse
from models.sensor_models import SensorReadingRaw, SensorReadingProcessed, SensorNode
from models.alert_models import Alert
from services.validation import validate_reading, normalize_timestamp
from services.feature_engineering import compute_features
from api.websocket import manager
from rules.risk_engine import evaluate_risk, save_risk_evaluation
from ml.inference import (
    run_full_inference,
    save_anomaly,
    save_prediction,
    update_risk_with_ml,
)
from sync.sync_service import enqueue_for_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])


# ---------------------------------------------------------------------------
# ALERT HELPERS
# ---------------------------------------------------------------------------

ALERT_LEVELS = {"YELLOW", "ORANGE", "RED"}


def _safe_float(value):
    """Return a JSON-safe float or None."""
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    """Return a JSON-safe integer or None."""
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _build_triggering_measurements(
    raw_reading,
    processed_reading,
    risk,
):
    """
    Capture the actual measurements/evidence present when the alert
    was generated or updated.

    This is stored in Alert.triggering_measurements so the alert remains
    auditable instead of containing only a risk label.
    """
    return {
        "reading_timestamp": (
            raw_reading.reading_timestamp.isoformat()
            if raw_reading.reading_timestamp
            else None
        ),
        "node_id": raw_reading.node_id,
        "zone_id": raw_reading.zone_id,

        # Ground movement
        "tilt_x": _safe_float(raw_reading.tilt_x),
        "tilt_y": _safe_float(raw_reading.tilt_y),
        "tilt_magnitude": _safe_float(raw_reading.tilt_magnitude),
        "displacement_mm": _safe_float(raw_reading.displacement_mm),
        "displacement_rate": _safe_float(raw_reading.displacement_rate),

        # Vibration
        "vibration_rms": _safe_float(raw_reading.vibration_rms),
        "vibration_peak": _safe_float(raw_reading.vibration_peak),
        "vibration_variance": _safe_float(raw_reading.vibration_variance),

        # Crack
        "crack_width_mm": _safe_float(raw_reading.crack_width_mm),
        "crack_detected": raw_reading.crack_detected,

        # Environment
        "temperature": _safe_float(raw_reading.temperature),
        "humidity": _safe_float(raw_reading.humidity),

        # Node/network health
        "battery_voltage": _safe_float(raw_reading.battery_voltage),
        "rssi": _safe_int(raw_reading.rssi),
        "packet_loss": _safe_float(raw_reading.packet_loss),
        "sensor_status": raw_reading.sensor_status,
        "calibration_status": raw_reading.calibration_status,

        # Processed evidence
        "tilt_rate": _safe_float(processed_reading.tilt_rate),
        "displacement_rate_smoothed": _safe_float(
            processed_reading.displacement_rate_smoothed
        ),
        "crack_growth_rate": _safe_float(
            processed_reading.crack_growth_rate
        ),
        "rolling_mean_displacement": _safe_float(
            processed_reading.rolling_mean_displacement
        ),
        "rolling_std_displacement": _safe_float(
            processed_reading.rolling_std_displacement
        ),
        "vibration_energy": _safe_float(
            processed_reading.vibration_energy
        ),
        "neighbor_displacement_diff": _safe_float(
            processed_reading.neighbor_displacement_diff
        ),
        "missing_packet_count": _safe_int(
            processed_reading.missing_packet_count
        ),
        "battery_trend": _safe_float(processed_reading.battery_trend),
        "rssi_trend": _safe_float(processed_reading.rssi_trend),
        "data_quality_score": _safe_float(
            processed_reading.data_quality_score
        ),

        # Risk-engine evidence
        "rule_triggered": risk.rule_triggered,
        "neighbor_agreement_count": _safe_int(
            risk.neighbor_agreement_count
        ),
        "persistence_seconds": _safe_int(
            risk.persistence_seconds
        ),
        "sensor_health_status": risk.sensor_health_status,
        "data_quality_status": risk.data_quality_status,
    }


def _build_alert_message(raw_reading, processed_reading, risk):
    """
    Build a human-readable alert message from the actual evidence.

    The message intentionally avoids claiming that collapse is certain.
    It describes observed indicators and recommends field assessment/
    monitoring appropriate to the prototype's decision-support role.
    """
    indicators = []

    displacement = _safe_float(raw_reading.displacement_mm)
    displacement_rate = _safe_float(raw_reading.displacement_rate)
    tilt = _safe_float(raw_reading.tilt_magnitude)
    vibration = _safe_float(raw_reading.vibration_rms)
    crack_width = _safe_float(raw_reading.crack_width_mm)

    if displacement is not None:
        indicators.append(f"displacement {displacement:.2f} mm")

    if displacement_rate is not None:
        indicators.append(
            f"displacement rate {displacement_rate:.2f} mm/h"
        )

    if tilt is not None:
        indicators.append(f"tilt {tilt:.2f}°")

    if vibration is not None:
        indicators.append(f"vibration RMS {vibration:.2f}")

    if crack_width is not None:
        indicators.append(f"crack width {crack_width:.2f} mm")

    if raw_reading.crack_detected:
        indicators.append("crack activity detected")

    if risk.rule_triggered:
        indicators.append(f"rule: {risk.rule_triggered}")

    if risk.anomaly_score is not None:
        indicators.append(
            f"anomaly score {float(risk.anomaly_score):.3f}"
        )

    if risk.neighbor_agreement_count:
        indicators.append(
            f"{int(risk.neighbor_agreement_count)} neighboring "
            f"node(s) in agreement"
        )

    if risk.persistence_seconds:
        indicators.append(
            f"persistent condition for "
            f"{int(risk.persistence_seconds)} s"
        )

    if not indicators:
        indicators.append("multiple monitored indicators require attention")

    evidence_text = "; ".join(indicators)

    if risk.risk_level == "YELLOW":
        return (
            "Early warning indicators detected. "
            f"Observed evidence: {evidence_text}. "
            "Continue close monitoring and review the affected area."
        )

    if risk.risk_level == "ORANGE":
        return (
            "Elevated subsidence indicators detected. "
            f"Observed evidence: {evidence_text}. "
            "Increase monitoring and perform a field assessment "
            "according to mine safety procedures."
        )

    if risk.risk_level == "RED":
        return (
            "Critical subsidence indicators detected. "
            f"Observed evidence: {evidence_text}. "
            "Immediate field assessment and appropriate safety "
            "response are recommended according to mine procedures."
        )

    return (
        f"Risk level {risk.risk_level}. "
        f"Observed evidence: {evidence_text}."
    )


def _build_alert_title(risk_level, zone):
    """Create a consistent alert title for the current zone risk episode."""
    zone_name = getattr(zone, "name", None) or getattr(
        zone, "zone_code", None
    ) or f"ZONE-{zone.id}"

    titles = {
        "YELLOW": "Early Subsidence Warning",
        "ORANGE": "Elevated Subsidence Risk",
        "RED": "Critical Subsidence Risk",
    }

    return f"{titles[risk_level]} — {zone_name}"


def _recommended_alert_action(risk_level, risk):
    """Return an action appropriate to the current risk level."""
    if risk.recommended_action:
        return risk.recommended_action

    if risk_level == "YELLOW":
        return (
            "Continue close monitoring and review the affected area."
        )

    if risk_level == "ORANGE":
        return (
            "Increase monitoring and perform a field assessment "
            "according to mine safety procedures."
        )

    if risk_level == "RED":
        return (
            "Immediate field assessment and appropriate safety "
            "response are recommended according to mine procedures."
        )

    return None


def _create_or_update_alert(
    db: Session,
    node,
    zone,
    processed_reading,
    raw_reading,
    risk,
):
    """
    Maintain one active alert for the current zone risk episode.

    Rules:
      GREEN/GREY -> no risk alert
      YELLOW/ORANGE/RED:
          same active level -> update existing alert
          changed active level -> resolve previous alert and create new one
    """
    risk_level = str(risk.risk_level).upper() if risk.risk_level else ""

    if risk_level not in ALERT_LEVELS:
        return None, "ignored"

    triggering_measurements = _build_triggering_measurements(
        raw_reading,
        processed_reading,
        risk,
    )

    message = _build_alert_message(
        raw_reading,
        processed_reading,
        risk,
    )

    title = _build_alert_title(risk_level, zone)

    recommended_action = _recommended_alert_action(
        risk_level,
        risk,
    )

    affected_node_id = node.node_id

    # Find the current active alert for this zone.
    #
    # There should only be one active risk episode per zone. This means
    # repeated readings do not generate an alert storm.
    active_alert = (
        db.query(Alert)
        .filter(
            Alert.zone_id == zone.id,
            Alert.status.in_(["active", "acknowledged"]),
        )
        .order_by(Alert.created_at.desc())
        .first()
    )

    if active_alert is not None:
        existing_level = str(
            active_alert.alert_level
        ).upper()

        # Same risk level:
        # update the existing alert instead of creating another alert.
        if existing_level == risk_level:
            affected_nodes = active_alert.affected_nodes

            if not isinstance(affected_nodes, list):
                affected_nodes = []

            if affected_node_id not in affected_nodes:
                affected_nodes.append(affected_node_id)

            active_alert.title = title
            active_alert.message = message
            active_alert.affected_nodes = affected_nodes
            active_alert.triggering_measurements = (
                triggering_measurements
            )
            active_alert.model_probability = risk.ml_probability
            active_alert.anomaly_score = risk.anomaly_score
            active_alert.data_quality_status = (
                risk.data_quality_status
            )
            active_alert.recommended_action = recommended_action

            # Keep an acknowledged alert acknowledged if the operator
            # has already acknowledged this same continuous episode.
            # New risk levels will create a fresh active alert below.
            db.commit()
            db.refresh(active_alert)

            logger.info(
                "Updated existing alert id=%s zone_id=%s "
                "level=%s node_id=%s",
                active_alert.id,
                zone.id,
                risk_level,
                node.node_id,
            )

            return active_alert, "updated"

        # Risk level changed:
        # finish the previous alert episode before opening a new one.
        active_alert.status = "resolved"
        active_alert.resolved_at = datetime.utcnow()

        logger.info(
            "Risk level changed for zone_id=%s: %s -> %s. "
            "Resolved alert id=%s.",
            zone.id,
            existing_level,
            risk_level,
            active_alert.id,
        )

    new_alert = Alert(
        risk_id=risk.id,
        zone_id=zone.id,
        alert_level=risk_level,
        title=title,
        message=message,
        affected_nodes=[affected_node_id],
        triggering_measurements=triggering_measurements,
        model_probability=risk.ml_probability,
        anomaly_score=risk.anomaly_score,
        data_quality_status=risk.data_quality_status,
        recommended_action=recommended_action,
        status="active",
        synchronization_status="pending",
    )

    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)

    logger.warning(
        "Created new alert id=%s zone_id=%s level=%s node_id=%s",
        new_alert.id,
        zone.id,
        risk_level,
        node.node_id,
    )

    return new_alert, "created"


def _enqueue_alert_sync(db: Session, alert):
    """Queue an alert for cloud synchronization without breaking ingestion."""
    try:
        enqueue_for_sync(
            db,
            entity_type="alert",
            entity_id=alert.id,
            payload={
                "risk_id": alert.risk_id,
                "zone_id": alert.zone_id,
                "alert_level": alert.alert_level,
                "title": alert.title,
                "message": alert.message,
                "affected_nodes": alert.affected_nodes,
                "triggering_measurements": (
                    alert.triggering_measurements
                ),
                "model_probability": alert.model_probability,
                "anomaly_score": alert.anomaly_score,
                "data_quality_status": (
                    alert.data_quality_status
                ),
                "recommended_action": alert.recommended_action,
                "status": alert.status,
                "created_at": (
                    alert.created_at.isoformat()
                    if alert.created_at
                    else None
                ),
                "resolved_at": (
                    alert.resolved_at.isoformat()
                    if alert.resolved_at
                    else None
                ),
            },
        )
    except Exception as exc:
        logger.warning(
            "Failed to enqueue alert %s for sync, continuing: %s",
            alert.id,
            exc,
        )


# ---------------------------------------------------------------------------
# INGESTION
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=SensorReadingIngestResponse,
)
async def ingest_reading(
    reading: SensorReadingIngest,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_ingestion_api_key),
):
    validation_result = validate_reading(db, reading)

    if not validation_result.is_valid:
        logger.warning(
            "Ingestion rejected for node_id=%s reason=%s",
            reading.node_id,
            validation_result.reason,
        )

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

    features = compute_features(
        db,
        node,
        raw_reading,
    )

    processed_reading = SensorReadingProcessed(
        raw_reading_id=raw_reading.id,
        node_id=node.id,
        zone_id=zone.id,
        reading_timestamp=timestamp,
        data_source=reading.data_source,
        tilt_rate=features["tilt_rate"],
        displacement_rate_smoothed=(
            features["displacement_rate_smoothed"]
        ),
        crack_growth_rate=features["crack_growth_rate"],
        rolling_mean_displacement=(
            features["rolling_mean_displacement"]
        ),
        rolling_std_displacement=(
            features["rolling_std_displacement"]
        ),
        vibration_energy=features["vibration_energy"],
        neighbor_displacement_diff=(
            features["neighbor_displacement_diff"]
        ),
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

    # -----------------------------------------------------------------------
    # RAW READING SYNC
    # -----------------------------------------------------------------------

    try:
        enqueue_for_sync(
            db,
            entity_type="sensor_reading_raw",
            entity_id=raw_reading.id,
            payload={
                "node_id": raw_reading.node_id,
                "zone_id": raw_reading.zone_id,
                "reading_timestamp": (
                    raw_reading.reading_timestamp.isoformat()
                ),
                "data_source": raw_reading.data_source,
                "tilt_x": raw_reading.tilt_x,
                "tilt_y": raw_reading.tilt_y,
                "tilt_magnitude": raw_reading.tilt_magnitude,
                "displacement_mm": raw_reading.displacement_mm,
                "displacement_rate": raw_reading.displacement_rate,
                "vibration_rms": raw_reading.vibration_rms,
                "vibration_peak": raw_reading.vibration_peak,
                "vibration_variance": raw_reading.vibration_variance,
                "crack_width_mm": raw_reading.crack_width_mm,
                "crack_detected": raw_reading.crack_detected,
                "temperature": raw_reading.temperature,
                "humidity": raw_reading.humidity,
                "battery_voltage": raw_reading.battery_voltage,
                "rssi": raw_reading.rssi,
                "packet_loss": raw_reading.packet_loss,
                "sensor_status": raw_reading.sensor_status,
                "calibration_status": raw_reading.calibration_status,
            },
        )
    except Exception as exc:
        logger.warning(
            "Failed to enqueue raw reading for sync, continuing: %s",
            exc,
        )

    # -----------------------------------------------------------------------
    # RISK ENGINE
    # -----------------------------------------------------------------------

    risk_result = evaluate_risk(
        db,
        node,
        raw_reading,
        processed_reading,
    )

    risk = save_risk_evaluation(
        db,
        risk_result,
    )

    logger.info(
        "Risk evaluated node_id=%s risk_id=%s risk_level=%s "
        "rule_triggered=%s",
        reading.node_id,
        risk.id,
        risk.risk_level,
        risk.rule_triggered,
    )

    # -----------------------------------------------------------------------
    # ML INFERENCE
    # -----------------------------------------------------------------------

    inference_result = None

    try:
        inference_result = run_full_inference(
            raw_reading,
            processed_reading,
            risk.risk_level,
        )

        anomaly_id = save_anomaly(
            db,
            node.id,
            zone.id,
            processed_reading.id,
            raw_reading.reading_timestamp,
            inference_result["isolation_forest"],
        )

        prediction_id = save_prediction(
            db,
            node.id,
            zone.id,
            raw_reading.reading_timestamp,
            inference_result["xgboost_regressor"],
        )

        update_risk_with_ml(
            db,
            risk.id,
            inference_result["xgboost_classifier"],
            inference_result["isolation_forest"],
        )

        db.refresh(risk)

        logger.info(
            "ML inference node_id=%s ml_risk_class=%s "
            "anomaly_status=%s predicted_displacement_mm=%s",
            reading.node_id,
            risk.ml_risk_class,
            (
                inference_result["isolation_forest"]["anomaly_status"]
                if inference_result["isolation_forest"]
                else None
            ),
            (
                inference_result["xgboost_regressor"][
                    "predicted_displacement_mm"
                ]
                if inference_result["xgboost_regressor"]
                else None
            ),
        )

        # ---------------------------------------------------------------
        # ANOMALY SYNC
        # ---------------------------------------------------------------

        if (
            inference_result["isolation_forest"] is not None
            and anomaly_id is not None
        ):
            try:
                enqueue_for_sync(
                    db,
                    entity_type="anomaly",
                    entity_id=anomaly_id,
                    payload={
                        "node_id": node.id,
                        "zone_id": zone.id,
                        "processed_reading_id": processed_reading.id,
                        "detected_at": (
                            raw_reading.reading_timestamp.isoformat()
                        ),
                        "anomaly_score": (
                            inference_result["isolation_forest"][
                                "anomaly_score"
                            ]
                        ),
                        "anomaly_status": (
                            inference_result["isolation_forest"][
                                "anomaly_status"
                            ]
                        ),
                        "model_version": (
                            inference_result["isolation_forest"][
                                "model_version"
                            ]
                        ),
                    },
                )
            except Exception as exc:
                logger.warning(
                    "Failed to enqueue anomaly for sync, continuing: %s",
                    exc,
                )

        # ---------------------------------------------------------------
        # PREDICTION SYNC
        # ---------------------------------------------------------------

        if (
            inference_result["xgboost_regressor"] is not None
            and prediction_id is not None
        ):
            try:
                enqueue_for_sync(
                    db,
                    entity_type="prediction",
                    entity_id=prediction_id,
                    payload={
                        "node_id": node.id,
                        "zone_id": zone.id,
                        "predicted_at": (
                            raw_reading.reading_timestamp.isoformat()
                        ),
                        "horizon_hours": (
                            inference_result["xgboost_regressor"][
                                "horizon_hours"
                            ]
                        ),
                        "predicted_displacement_mm": (
                            inference_result["xgboost_regressor"][
                                "predicted_displacement_mm"
                            ]
                        ),
                        "trend_direction": (
                            inference_result["xgboost_regressor"][
                                "trend_direction"
                            ]
                        ),
                        "confidence": (
                            inference_result["xgboost_regressor"][
                                "confidence"
                            ]
                        ),
                        "model_name": "xgboost_regressor",
                        "model_version": (
                            inference_result["xgboost_regressor"][
                                "model_version"
                            ]
                        ),
                    },
                )
            except Exception as exc:
                logger.warning(
                    "Failed to enqueue prediction for sync, continuing: %s",
                    exc,
                )

    except Exception as exc:
        logger.warning(
            "ML inference failed for node_id=%s, continuing with "
            "rule-engine-only risk: %s",
            reading.node_id,
            exc,
        )

    # -----------------------------------------------------------------------
    # AUTOMATIC ALERT GENERATION
    # -----------------------------------------------------------------------

    alert = None
    alert_action = "none"

    try:
        alert, alert_action = _create_or_update_alert(
            db,
            node,
            zone,
            processed_reading,
            raw_reading,
            risk,
        )

        if alert is not None:
            _enqueue_alert_sync(
                db,
                alert,
            )

            logger.info(
                "Alert lifecycle action=%s alert_id=%s "
                "zone_id=%s level=%s",
                alert_action,
                alert.id,
                zone.id,
                alert.alert_level,
            )

    except Exception as exc:
        # Alert failure must not reject an otherwise valid sensor reading.
        logger.exception(
            "Alert generation failed for node_id=%s: %s",
            reading.node_id,
            exc,
        )

    # -----------------------------------------------------------------------
    # RISK SYNC
    # -----------------------------------------------------------------------

    try:
        enqueue_for_sync(
            db,
            entity_type="risk",
            entity_id=risk.id,
            payload={
                "zone_id": risk.zone_id,
                "node_id": risk.node_id,
                "evaluated_at": risk.evaluated_at.isoformat(),
                "risk_level": risk.risk_level,
                "rule_triggered": risk.rule_triggered,
                "ml_risk_class": risk.ml_risk_class,
                "ml_probability": risk.ml_probability,
                "anomaly_score": risk.anomaly_score,
                "sensor_health_status": risk.sensor_health_status,
                "neighbor_agreement_count": (
                    risk.neighbor_agreement_count
                ),
                "persistence_seconds": risk.persistence_seconds,
                "data_quality_status": risk.data_quality_status,
                "recommended_action": risk.recommended_action,
            },
        )
    except Exception as exc:
        logger.warning(
            "Failed to enqueue risk for sync, continuing: %s",
            exc,
        )

    # -----------------------------------------------------------------------
    # WEBSOCKET
    # -----------------------------------------------------------------------

    await manager.broadcast(
        {
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
            "risk_level": risk.risk_level,
            "rule_triggered": risk.rule_triggered,
            "ml_risk_class": risk.ml_risk_class,
            "ml_probability": risk.ml_probability,
            "anomaly_score": risk.anomaly_score,
            "predicted_displacement_mm": (
                inference_result["xgboost_regressor"][
                    "predicted_displacement_mm"
                ]
                if (
                    inference_result
                    and inference_result["xgboost_regressor"]
                )
                else None
            ),
            "trend_direction": (
                inference_result["xgboost_regressor"][
                    "trend_direction"
                ]
                if (
                    inference_result
                    and inference_result["xgboost_regressor"]
                )
                else None
            ),
        }
    )

    return SensorReadingIngestResponse(
        raw_reading_id=raw_reading.id,
        processed_reading_id=processed_reading.id,
        data_quality_score=features["data_quality_score"],
        accepted=True,
        reason=None,
    )