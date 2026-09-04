from typing import Optional
from rules import thresholds


LEVEL_RANK = {
    "GREEN": 0,
    "YELLOW": 1,
    "ORANGE": 2,
    "RED": 3,
}


def _level_for_value(value: Optional[float], yellow: float, orange: float, red: float) -> str:
    if value is None:
        return "GREEN"
    if value >= red:
        return "RED"
    if value >= orange:
        return "ORANGE"
    if value >= yellow:
        return "YELLOW"
    return "GREEN"


def _higher(a: str, b: str) -> str:
    return a if LEVEL_RANK[a] >= LEVEL_RANK[b] else b


def evaluate_tilt_magnitude(tilt_magnitude: Optional[float]) -> str:
    return _level_for_value(
        tilt_magnitude,
        thresholds.TILT_MAGNITUDE_YELLOW,
        thresholds.TILT_MAGNITUDE_ORANGE,
        thresholds.TILT_MAGNITUDE_RED,
    )


def evaluate_tilt_rate(tilt_rate: Optional[float]) -> str:
    abs_rate = abs(tilt_rate) if tilt_rate is not None else None
    return _level_for_value(
        abs_rate,
        thresholds.TILT_RATE_YELLOW,
        thresholds.TILT_RATE_ORANGE,
        thresholds.TILT_RATE_RED,
    )


def evaluate_displacement(displacement_mm: Optional[float]) -> str:
    return _level_for_value(
        displacement_mm,
        thresholds.DISPLACEMENT_MM_YELLOW,
        thresholds.DISPLACEMENT_MM_ORANGE,
        thresholds.DISPLACEMENT_MM_RED,
    )


def evaluate_displacement_rate(displacement_rate_smoothed: Optional[float]) -> str:
    abs_rate = abs(displacement_rate_smoothed) if displacement_rate_smoothed is not None else None
    return _level_for_value(
        abs_rate,
        thresholds.DISPLACEMENT_RATE_YELLOW,
        thresholds.DISPLACEMENT_RATE_ORANGE,
        thresholds.DISPLACEMENT_RATE_RED,
    )


def evaluate_crack_width(crack_width_mm: Optional[float]) -> str:
    return _level_for_value(
        crack_width_mm,
        thresholds.CRACK_WIDTH_MM_YELLOW,
        thresholds.CRACK_WIDTH_MM_ORANGE,
        thresholds.CRACK_WIDTH_MM_RED,
    )


def evaluate_crack_growth_rate(crack_growth_rate: Optional[float]) -> str:
    abs_rate = abs(crack_growth_rate) if crack_growth_rate is not None else None
    return _level_for_value(
        abs_rate,
        thresholds.CRACK_GROWTH_RATE_YELLOW,
        thresholds.CRACK_GROWTH_RATE_ORANGE,
        thresholds.CRACK_GROWTH_RATE_RED,
    )


def evaluate_vibration_energy(vibration_energy: Optional[float], rolling_baseline: Optional[float]) -> str:
    if vibration_energy is None or rolling_baseline is None or rolling_baseline <= 0:
        return "GREEN"
    ratio = vibration_energy / rolling_baseline
    return _level_for_value(
        ratio,
        thresholds.VIBRATION_ENERGY_BASELINE_MULTIPLIER_YELLOW,
        thresholds.VIBRATION_ENERGY_BASELINE_MULTIPLIER_ORANGE,
        thresholds.VIBRATION_ENERGY_BASELINE_MULTIPLIER_RED,
    )


def evaluate_crack_detected(crack_detected: Optional[bool]) -> str:
    if crack_detected:
        return thresholds.CRACK_DETECTED_MIN_LEVEL
    return "GREEN"


def evaluate_all_fields(
    tilt_magnitude: Optional[float],
    tilt_rate: Optional[float],
    displacement_mm: Optional[float],
    displacement_rate_smoothed: Optional[float],
    crack_width_mm: Optional[float],
    crack_growth_rate: Optional[float],
    crack_detected: Optional[bool],
    vibration_energy: Optional[float],
    vibration_energy_rolling_baseline: Optional[float],
) -> dict:
    field_levels = {
        "tilt_magnitude": evaluate_tilt_magnitude(tilt_magnitude),
        "tilt_rate": evaluate_tilt_rate(tilt_rate),
        "displacement_mm": evaluate_displacement(displacement_mm),
        "displacement_rate_smoothed": evaluate_displacement_rate(displacement_rate_smoothed),
        "crack_width_mm": evaluate_crack_width(crack_width_mm),
        "crack_growth_rate": evaluate_crack_growth_rate(crack_growth_rate),
        "crack_detected": evaluate_crack_detected(crack_detected),
        "vibration_energy": evaluate_vibration_energy(vibration_energy, vibration_energy_rolling_baseline),
    }

    worst_level = "GREEN"
    worst_field = None
    for field_name, level in field_levels.items():
        if LEVEL_RANK[level] > LEVEL_RANK[worst_level]:
            worst_level = level
            worst_field = field_name

    return {
        "field_levels": field_levels,
        "worst_level": worst_level,
        "worst_field": worst_field,
    }
