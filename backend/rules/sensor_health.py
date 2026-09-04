from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from models.sensor_models import SensorNode, SensorReadingRaw, SensorReadingProcessed
from rules import thresholds


def get_expected_interval_seconds(node: SensorNode) -> int:
    return 60


def is_reading_stale(reading_timestamp: datetime, now: datetime, expected_interval_seconds: int) -> bool:
    elapsed = (now - reading_timestamp).total_seconds()
    return elapsed > (expected_interval_seconds * thresholds.STALE_READING_INTERVAL_MULTIPLIER)


def get_data_quality_status(data_quality_score: Optional[float]) -> str:
    if data_quality_score is None:
        return thresholds.DATA_QUALITY_STATUS_POOR
    if data_quality_score >= thresholds.DATA_QUALITY_SCORE_GOOD_THRESHOLD:
        return thresholds.DATA_QUALITY_STATUS_GOOD
    if data_quality_score >= thresholds.DATA_QUALITY_SCORE_FAIR_THRESHOLD:
        return thresholds.DATA_QUALITY_STATUS_FAIR
    return thresholds.DATA_QUALITY_STATUS_POOR


def evaluate_sensor_health(
    node: SensorNode,
    raw_reading: SensorReadingRaw,
    processed_reading: SensorReadingProcessed,
    now: datetime,
) -> dict:
    sensor_status = raw_reading.sensor_status
    calibration_status = raw_reading.calibration_status
    data_quality_score = processed_reading.data_quality_score if processed_reading else None

    if sensor_status in thresholds.SENSOR_STATUS_OFFLINE_VALUES:
        return {
            "is_grey": True,
            "sensor_health_status": thresholds.SENSOR_HEALTH_OFFLINE,
            "rule_triggered": thresholds.RULE_TRIGGERED_SENSOR_OFFLINE,
            "data_quality_status": get_data_quality_status(data_quality_score),
        }

    expected_interval = get_expected_interval_seconds(node)
    if is_reading_stale(raw_reading.reading_timestamp, now, expected_interval):
        return {
            "is_grey": True,
            "sensor_health_status": thresholds.SENSOR_HEALTH_OFFLINE,
            "rule_triggered": thresholds.RULE_TRIGGERED_SENSOR_STALE,
            "data_quality_status": get_data_quality_status(data_quality_score),
        }

    if data_quality_score is not None and data_quality_score < thresholds.DATA_QUALITY_SCORE_GREY_THRESHOLD:
        return {
            "is_grey": True,
            "sensor_health_status": thresholds.SENSOR_HEALTH_DEGRADED,
            "rule_triggered": thresholds.RULE_TRIGGERED_LOW_DATA_QUALITY,
            "data_quality_status": get_data_quality_status(data_quality_score),
        }

    if calibration_status == thresholds.CALIBRATION_STATUS_UNCALIBRATED:
        return {
            "is_grey": False,
            "sensor_health_status": thresholds.SENSOR_HEALTH_UNCALIBRATED,
            "rule_triggered": None,
            "data_quality_status": get_data_quality_status(data_quality_score),
        }

    return {
        "is_grey": False,
        "sensor_health_status": thresholds.SENSOR_HEALTH_HEALTHY,
        "rule_triggered": None,
        "data_quality_status": get_data_quality_status(data_quality_score),
    }
