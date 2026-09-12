"""
node_simulator.py
-------------------
Builds SensorReadingIngest-shaped payloads (exact field names from
sensor_schemas.py) for a given node + scenario + tick. No HTTP calls and
no backend logic here — demo.py owns the actual POSTing so this module
stays trivially testable/importable on its own.
"""

import itertools
import random

from scenarios import BASELINE, SCENARIOS, _jitter


class SequenceCounter:
    """One monotonically-increasing sequence_number per node, independent
    of which scenario is currently running for that node."""

    def __init__(self):
        self._counters = {}

    def next(self, node_id):
        if node_id not in self._counters:
            self._counters[node_id] = itertools.count(start=1)
        return next(self._counters[node_id])


def build_reading(node, zone_id_field, scenario_name, tick_overrides, seq_counter):
    """
    node: dict with at least 'node_id' (str) and 'data_source' ("real"|"simulated")
          — data_source MUST match what the node was registered with; the
          simulator does not (and should not) override a real node's
          data_source to "simulated" or vice versa.
    zone_id_field: the value to send as SensorReadingIngest.zone_id (str).
          NOT CONFIRMED whether the backend expects the zone_code (e.g. "A")
          or str(zone numeric id) here — services/validation.py wasn't
          available this chat. Defaulted to zone_code in demo.py with a
          loud comment; if ingestion responses come back with
          accepted=False, check the `reason` field first — that's exactly
          what it's for.
    scenario_name: key into scenarios.SCENARIOS
    tick_overrides: the dict for this specific tick, as returned by the
          scenario generator (already sliced by the caller)
    seq_counter: shared SequenceCounter instance across the whole run
    """
    reading = dict(BASELINE)
    reading.update(tick_overrides)

    # Apply jitter only to fields the scenario didn't already set to a
    # deliberately extreme/erratic value (sensor_failure sets its own
    # randoms already).
    if scenario_name != "sensor_failure":
        for field in list(reading.keys()):
            reading[field] = _jitter(field, reading[field])

    # rssi is int in SensorReadingIngest; jitter (and some scenario
    # curves) produce floats. Round everywhere it might have drifted.
    if reading.get("rssi") is not None:
        reading["rssi"] = int(round(reading["rssi"]))

    reading["node_id"] = node["node_id"]
    reading["zone_id"] = zone_id_field
    reading["data_source"] = node["data_source"]
    reading["sequence_number"] = seq_counter.next(node["node_id"])
    # reading_timestamp intentionally omitted -> backend's
    # normalize_timestamp() assigns "now", which is what we want for a
    # live demo (do not backdate).

    return reading


def should_skip_tick(scenario_name, tick_index, total_ticks):
    """comms_failure should demonstrate actual dropped packets, not just
    a high packet_loss *value* — real packet loss means the reading never
    arrives at all. Skips ~35% of ticks in the back half of the
    comms_failure scenario. All other scenarios never skip."""
    if scenario_name != "comms_failure":
        return False
    if tick_index < total_ticks // 2:
        return False
    return random.random() < 0.35


def generate_run(node, zone_id_field, scenario_name, ticks=None):
    """Yields (tick_index, reading_dict_or_None) for one node running one
    scenario. None means "this tick should be skipped" (see
    should_skip_tick) — caller must not POST for that tick."""
    scenario_fn = SCENARIOS[scenario_name]
    overrides_seq = scenario_fn() if ticks is None else scenario_fn(ticks)
    total = len(overrides_seq)
    seq_counter = build_reading.__globals__.setdefault("_SHARED_SEQ", SequenceCounter())

    for i, overrides in enumerate(overrides_seq):
        if should_skip_tick(scenario_name, i, total):
            yield i, None
            continue
        yield i, build_reading(node, zone_id_field, scenario_name, overrides, seq_counter)
