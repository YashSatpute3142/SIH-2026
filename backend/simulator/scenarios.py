"""
scenarios.py
-------------
The 10 required scenarios from MASTER_PLAN.md Chat 2, expressed as pure
per-tick field-override sequences. No backend logic lives here — these
are just realistic curves for the sensor fields defined in
SensorReadingIngest (sensor_schemas.py). node_simulator.py layers these
on top of a baseline reading and sends the result through the real
ingestion endpoint, so the real rule engine / ML models decide the
resulting risk level, not this file.

Each scenario function returns a list of dicts, one per tick, containing
ONLY the fields that scenario deviates on. node_simulator.py merges each
tick's dict onto BASELINE + per-tick jitter.
"""

import random

# Baseline "normal operating" values for every field in SensorReadingIngest
# that the simulator populates. Matches sensor_schemas.py field names
# exactly. Fields not listed here (reading_timestamp, sequence_number,
# node_id, zone_id, data_source) are filled in by node_simulator.py per
# reading, not per scenario.
BASELINE = {
    "tilt_x": 0.05,
    "tilt_y": -0.03,
    "tilt_magnitude": 0.06,
    "displacement_mm": 0.5,
    "displacement_rate": 0.01,
    "vibration_rms": 0.02,
    "vibration_peak": 0.05,
    "vibration_variance": 0.001,
    "crack_width_mm": 0.1,
    "crack_detected": False,
    "temperature": 26.0,
    "humidity": 55.0,
    "battery_voltage": 3.9,
    "rssi": -65,
    "packet_loss": 0.01,
    "sensor_status": "ok",
    "calibration_status": "calibrated",
}

JITTER = {
    "tilt_x": 0.01, "tilt_y": 0.01, "tilt_magnitude": 0.01,
    "displacement_mm": 0.03, "vibration_rms": 0.005, "vibration_peak": 0.01,
    "temperature": 0.3, "humidity": 1.0, "battery_voltage": 0.01, "rssi": 2,
}


def _jitter(field, value):
    spread = JITTER.get(field)
    if spread is None or value is None or not isinstance(value, (int, float)):
        return value
    return value + random.uniform(-spread, spread)


def normal(ticks=3):
    """No degradation — steady-state baseline. Used as a control and as
    the resting profile most other scenarios start/end from."""
    return [{} for _ in range(ticks)]


def gradual_deformation(ticks=5):
    """Slow, monotonic displacement/tilt increase — the classic creeping
    subsidence signature, meant to eventually cross YELLOW/ORANGE
    thresholds in the real rule engine."""
    out = []
    for i in range(ticks):
        frac = i / max(ticks - 1, 1)
        out.append({
            "displacement_mm": 0.5 + frac * 22.0,
            "displacement_rate": 0.01 + frac * 0.9,
            "tilt_magnitude": 0.06 + frac * 1.2,
            "tilt_x": 0.05 + frac * 0.8,
        })
    return out


def sudden_deformation(ticks=5):
    """Sharp deformation event that becomes severe and remains sustained
    long enough for the real rule engine to demonstrate the full
    YELLOW -> ORANGE -> RED progression."""
    out = []

    for i in range(ticks):
        if i < 2:
            # Normal / pre-event
            out.append({})

        elif i < 4:
            # Initial deformation
            out.append({
                "displacement_mm": 10.0 + random.uniform(-0.3, 0.3),
                "displacement_rate": 1.5,
                "tilt_magnitude": 0.9,
            })

        else:
            # Sustained severe deformation
            out.append({
                "displacement_mm": 25.0 + random.uniform(-0.5, 0.5),
                "displacement_rate": 4.0,
                "tilt_magnitude": 2.2,
                "crack_width_mm": 3.5,
                "crack_detected": True,
            })

    return out


def crack_growth(ticks=4):
    """Crack width ramps up; crack_detected flips True once past a
    visually-plausible threshold (2mm)."""
    out = []
    for i in range(ticks):
        frac = i / max(ticks - 1, 1)
        width = 0.1 + frac * 7.5
        out.append({
            "crack_width_mm": width,
            "crack_detected": width > 2.0,
        })
    return out


def external_vibration(ticks=4):
    """Temporary vibration spike (blasting/heavy equipment nearby) that
    returns to baseline — tests that the rule engine doesn't confuse this
    with a structural signature."""
    out = []
    spike_start, spike_end = ticks // 3, 2 * ticks // 3
    for i in range(ticks):
        if spike_start <= i < spike_end:
            out.append({
                "vibration_rms": 1.2 + random.uniform(-0.1, 0.1),
                "vibration_peak": 2.5,
                "vibration_variance": 0.4,
            })
        else:
            out.append({})
    return out


def sensor_failure(ticks=3):
    """Node starts reporting garbage/erratic values partway through and
    flags itself faulty. Fields stay present (not None) with implausible
    values, since we don't know how strictly validate_reading treats
    None — sensor_status="fault" is the primary signal."""
    out = []
    fail_at = ticks // 3
    for i in range(ticks):
        if i < fail_at:
            out.append({})
        else:
            out.append({
                "sensor_status": "fault",
                "displacement_mm": random.uniform(-50, 50),
                "vibration_rms": random.uniform(0, 5),
                "tilt_magnitude": random.uniform(0, 10),
            })
    return out


def low_battery(ticks=3):
    """Steady battery drain from healthy to critically low."""
    out = []
    for i in range(ticks):
        frac = i / max(ticks - 1, 1)
        out.append({"battery_voltage": round(3.9 - frac * 1.5, 3)})
    return out


def comms_failure(ticks=3):
    """Rising packet loss and collapsing RSSI. node_simulator.py should
    also literally skip sending some ticks for this scenario to simulate
    dropped packets, not just report a high packet_loss value."""
    out = []
    for i in range(ticks):
        frac = i / max(ticks - 1, 1)
        out.append({
            "packet_loss": round(0.01 + frac * 0.65, 3),
            "rssi": int(-65 - frac * 45),
        })
    return out


def internet_outage(ticks=3):
    """Node-side behavior is unaffected by an internet/cloud-sync outage
    — that's a gateway/edge<->cloud layer concern (Chat 6's
    /api/sync/toggle-internet), not a sensor-layer one. This scenario is
    intentionally just the normal profile at the ingestion level; the
    actual outage should be exercised by calling the sync endpoints
    directly (see run_sync_demo in the earlier full-feature script), not
    by mutating sensor readings here."""
    return normal(ticks)


def recovery(ticks=5, start_displacement=18.0, start_vibration=1.0):
    """Decays from an elevated state back to baseline — pair this after
    sudden_deformation or external_vibration in a run to demo the RED/
    ORANGE -> GREEN recovery path end to end."""
    out = []
    for i in range(ticks):
        frac = i / max(ticks - 1, 1)
        out.append({
            "displacement_mm": start_displacement * (1 - frac) + 0.5 * frac,
            "displacement_rate": max(0.01, 2.0 * (1 - frac)),
            "vibration_rms": start_vibration * (1 - frac) + 0.02 * frac,
        })
    return out


SCENARIOS = {
    "normal": normal,
    "gradual_deformation": gradual_deformation,
    "sudden_deformation": sudden_deformation,
    "crack_growth": crack_growth,
    "external_vibration": external_vibration,
    "sensor_failure": sensor_failure,
    "low_battery": low_battery,
    "comms_failure": comms_failure,
    "internet_outage": internet_outage,
    "recovery": recovery,
}
