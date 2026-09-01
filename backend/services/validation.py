import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from models.sensor_models import SensorNode, Zone
from schemas.sensor_schemas import SensorReadingIngest

logger = logging.getLogger(__name__)

VALID_SENSOR_STATUSES = {"ok", "fault", "recovering", "uncalibrated", "offline"}
VALID_CALIBRATION_STATUSES = {"calibrated", "uncalibrated", "unknown", "pending"}

TILT_RANGE = (-90.0, 90.0)
DISPLACEMENT_RANGE = (-50.0, 500.0)
VIBRATION_RANGE = (0.0, 50.0)
CRACK_WIDTH_RANGE = (0.0, 200.0)
TEMPERATURE_RANGE = (-40.0, 85.0)
HUMIDITY_RANGE = (0.0, 100.0)
BATTERY_RANGE = (0.0, 5.0)
RSSI_RANGE = (-130, 0)
PACKET_LOSS_RANGE = (0.0, 1.0)


class ValidationResult:
    def __init__(self, is_valid: bool, node: Optional[SensorNode], zone: Optional[Zone], reason: Optional[str] = None):
        self.is_valid = is_valid
        self.node = node
        self.zone = zone
        self.reason = reason


def _in_range(value, bounds):
    if value is None:
        return True
    low, high = bounds
    return low <= value <= high


def resolve_node_and_zone(db: Session, reading: SensorReadingIngest) -> ValidationResult:
    node = db.query(SensorNode).filter(SensorNode.node_id == reading.node_id).one_or_none()

    if node is None:
        logger.warning("Rejected reading: unknown node_id %s", reading.node_id)
        return ValidationResult(False, None, None, reason=f"Unknown node_id: {reading.node_id}")

    zone = db.query(Zone).filter(Zone.zone_code == reading.zone_id).one_or_none()

    if zone is None:
        logger.warning("Rejected reading: unknown zone_id %s", reading.zone_id)
        return ValidationResult(False, node, None, reason=f"Unknown zone_id: {reading.zone_id}")

    if node.zone_id != zone.id:
        logger.warning(
            "Rejected reading: node %s does not belong to zone %s",
            reading.node_id,
            reading.zone_id,
        )
        return ValidationResult(False, node, zone, reason="Node/zone mismatch")

    if node.data_source != reading.data_source:
        logger.warning(
            "Rejected reading: data_source mismatch for node %s (expected %s, got %s)",
            reading.node_id,
            node.data_source,
            reading.data_source,
        )
        return ValidationResult(False, node, zone, reason="data_source does not match registered node")

    return ValidationResult(True, node, zone)


def validate_field_ranges(reading: SensorReadingIngest) -> Optional[str]:
    checks = [
        (reading.tilt_x, TILT_RANGE, "tilt_x"),
        (reading.tilt_y, TILT_RANGE, "tilt_y"),
        (reading.tilt_magnitude, TILT_RANGE, "tilt_magnitude"),
        (reading.displacement_mm, DISPLACEMENT_RANGE, "displacement_mm"),
        (reading.vibration_rms, VIBRATION_RANGE, "vibration_rms"),
        (reading.vibration_peak, VIBRATION_RANGE, "vibration_peak"),
        (reading.crack_width_mm, CRACK_WIDTH_RANGE, "crack_width_mm"),
        (reading.temperature, TEMPERATURE_RANGE, "temperature"),
        (reading.humidity, HUMIDITY_RANGE, "humidity"),
        (reading.battery_voltage, BATTERY_RANGE, "battery_voltage"),
        (reading.rssi, RSSI_RANGE, "rssi"),
        (reading.packet_loss, PACKET_LOSS_RANGE, "packet_loss"),
    ]

    for value, bounds, field_name in checks:
        if not _in_range(value, bounds):
            return f"{field_name} out of range: {value}"

    if reading.sensor_status is not None and reading.sensor_status not in VALID_SENSOR_STATUSES:
        return f"Invalid sensor_status: {reading.sensor_status}"

    if reading.calibration_status is not None and reading.calibration_status not in VALID_CALIBRATION_STATUSES:
        return f"Invalid calibration_status: {reading.calibration_status}"

    return None


def normalize_timestamp(reading: SensorReadingIngest) -> datetime:
    if reading.reading_timestamp is not None:
        return reading.reading_timestamp
    return datetime.now(timezone.utc).replace(tzinfo=None)


def validate_reading(db: Session, reading: SensorReadingIngest) -> ValidationResult:
    resolution = resolve_node_and_zone(db, reading)

    if not resolution.is_valid:
        return resolution

    range_error = validate_field_ranges(reading)

    if range_error is not None:
        logger.warning("Rejected reading from %s: %s", reading.node_id, range_error)
        return ValidationResult(False, resolution.node, resolution.zone, reason=range_error)

    return resolution
