import logging
import math
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from models.sensor_models import SensorReadingRaw, SensorNode

logger = logging.getLogger(__name__)

ROLLING_WINDOW_SIZE = 10
BATTERY_TREND_WINDOW = 5
RSSI_TREND_WINDOW = 5


def _get_recent_readings(db: Session, node_id: int, before_timestamp: datetime, limit: int):
    return (
        db.query(SensorReadingRaw)
        .filter(SensorReadingRaw.node_id == node_id)
        .filter(SensorReadingRaw.reading_timestamp <= before_timestamp)
        .order_by(SensorReadingRaw.reading_timestamp.desc())
        .limit(limit)
        .all()
    )


def _mean(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return sum(values) / len(values)


def _std(values):
    values = [v for v in values if v is not None]
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def _rate_of_change(current, previous, seconds_elapsed):
    if current is None or previous is None or seconds_elapsed is None or seconds_elapsed <= 0:
        return None
    return (current - previous) / seconds_elapsed


def _trend(values):
    values = [v for v in values if v is not None]
    if len(values) < 2:
        return None
    return values[0] - values[-1]


def compute_neighbor_displacement_diff(db: Session, node: SensorNode, current_displacement: Optional[float], reading_timestamp: datetime) -> Optional[float]:
    if current_displacement is None:
        return None

    neighbor_nodes = (
        db.query(SensorNode)
        .filter(SensorNode.zone_id == node.zone_id)
        .filter(SensorNode.id != node.id)
        .all()
    )

    if not neighbor_nodes:
        return None

    neighbor_ids = [n.id for n in neighbor_nodes]

    neighbor_readings = (
        db.query(SensorReadingRaw)
        .filter(SensorReadingRaw.node_id.in_(neighbor_ids))
        .filter(SensorReadingRaw.reading_timestamp <= reading_timestamp)
        .order_by(SensorReadingRaw.reading_timestamp.desc())
        .limit(len(neighbor_ids) * 3)
        .all()
    )

    latest_per_neighbor = {}
    for r in neighbor_readings:
        if r.node_id not in latest_per_neighbor:
            latest_per_neighbor[r.node_id] = r.displacement_mm

    neighbor_values = [v for v in latest_per_neighbor.values() if v is not None]

    if not neighbor_values:
        return None

    neighbor_mean = sum(neighbor_values) / len(neighbor_values)
    return abs(current_displacement - neighbor_mean)


def compute_data_quality_score(
    packet_loss: Optional[float],
    missing_packet_count: int,
    sensor_status: Optional[str],
    calibration_status: Optional[str],
    rssi: Optional[int],
) -> float:
    score = 1.0

    if packet_loss is not None:
        score -= min(packet_loss, 1.0) * 0.4

    score -= min(missing_packet_count, 10) * 0.03

    if sensor_status == "fault":
        score -= 0.5
    elif sensor_status == "recovering":
        score -= 0.2
    elif sensor_status == "offline":
        score -= 0.7

    if calibration_status == "uncalibrated":
        score -= 0.2

    if rssi is not None and rssi < -100:
        score -= 0.1

    return max(0.0, min(1.0, round(score, 4)))


def compute_features(db: Session, node: SensorNode, raw_reading: SensorReadingRaw) -> dict:
    history = _get_recent_readings(db, node.id, raw_reading.reading_timestamp, ROLLING_WINDOW_SIZE)

    displacement_values = [r.displacement_mm for r in history]
    rolling_mean_displacement = _mean(displacement_values)
    rolling_std_displacement = _std(displacement_values)

    previous_reading = history[1] if len(history) > 1 else None
    seconds_elapsed = None
    if previous_reading is not None:
        seconds_elapsed = (raw_reading.reading_timestamp - previous_reading.reading_timestamp).total_seconds()

    tilt_rate = _rate_of_change(
        raw_reading.tilt_magnitude,
        previous_reading.tilt_magnitude if previous_reading else None,
        seconds_elapsed,
    )

    displacement_rate_smoothed = _rate_of_change(
        raw_reading.displacement_mm,
        previous_reading.displacement_mm if previous_reading else None,
        seconds_elapsed,
    )

    crack_growth_rate = _rate_of_change(
        raw_reading.crack_width_mm,
        previous_reading.crack_width_mm if previous_reading else None,
        seconds_elapsed,
    )

    vibration_energy = None
    if raw_reading.vibration_rms is not None and raw_reading.vibration_peak is not None:
        vibration_energy = (raw_reading.vibration_rms ** 2) + (raw_reading.vibration_peak ** 2)

    battery_history = [r.battery_voltage for r in history[:BATTERY_TREND_WINDOW]]
    battery_trend = _trend(battery_history)

    rssi_history = [float(r.rssi) if r.rssi is not None else None for r in history[:RSSI_TREND_WINDOW]]
    rssi_trend = _trend(rssi_history)

    missing_packet_count = 0
    if raw_reading.sequence_number is not None and previous_reading is not None and previous_reading.sequence_number is not None:
        gap = raw_reading.sequence_number - previous_reading.sequence_number
        if gap > 1:
            missing_packet_count = gap - 1

    neighbor_displacement_diff = compute_neighbor_displacement_diff(
        db, node, raw_reading.displacement_mm, raw_reading.reading_timestamp
    )

    data_quality_score = compute_data_quality_score(
        raw_reading.packet_loss,
        missing_packet_count,
        raw_reading.sensor_status,
        raw_reading.calibration_status,
        raw_reading.rssi,
    )

    return {
        "tilt_rate": tilt_rate,
        "displacement_rate_smoothed": displacement_rate_smoothed,
        "crack_growth_rate": crack_growth_rate,
        "rolling_mean_displacement": rolling_mean_displacement,
        "rolling_std_displacement": rolling_std_displacement,
        "vibration_energy": vibration_energy,
        "neighbor_displacement_diff": neighbor_displacement_diff,
        "missing_packet_count": missing_packet_count,
        "battery_trend": battery_trend,
        "rssi_trend": rssi_trend,
        "data_quality_score": data_quality_score,
    }
