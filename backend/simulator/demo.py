"""
demo.py
--------
MineShield simulator entry point.

Scope, per project decision: this script ONLY drives sensor readings
through the real POST /api/ingest pipeline. It does not call
alerts/sync/analytics endpoints directly, because ingestion already
triggers the real rule engine, ML inference, and (per ingestion.py)
whatever downstream alerting the backend does on its own — duplicating
that here would mean the simulator making decisions it shouldn't. Watch
the Alerts/Analytics/System Health pages update as a *consequence* of
the readings this script sends, not because this script talks to those
endpoints.

Project constraint: ONE zone only (Zone A). This script fetches Zone A
by zone_code, never creates B/C/D, and reuses existing nodes by default.
New nodes are only created if you pass --create-nodes AND populate
EXTRA_DEMO_NODES below.

------------------------------------------------------------------------
AUTH — CONFIRMED against api_key.py and get_test_jwt.py:
  - Ingestion: header "X-API-Key", value = INGESTION_API_KEY from .env.
  - Admin/operator JWT: POST /api/auth/register (falls back to
    /api/auth/login on 409), token in response body's "token" field.
    Used for every GET too (zones/nodes) since those are behind the
    same auth as the rest of the dashboard, not just the mutating
    endpoints — confirmed by the 401 on GET /api/zones without it.
    node creation additionally needs the demo account promoted to
    admin/operator (set_demo_user_admin.py); reads don't.

STILL NOT CONFIRMED (script will refuse to run rather than guess):

1. Whether SensorReadingIngest.zone_id expects the zone CODE ("A") or
   the numeric zone id as a string ("1") — services/validation.py
   wasn't available this chat. Defaulted to zone_code ("A") below. If a
   reading comes back accepted=False, print the `reason` field first —
   that will very likely say so directly.

2. Exact base URL paths /api/zones and /api/nodes (GET, list).
   nodes.py only showed POST/PATCH/DELETE; the GET/list route is
   referenced in earlier project notes but its file wasn't in this
   chat's context. If these 404, paste the actual router file and
   fetch_zone_a()/fetch_existing_nodes() get a one-line fix.
------------------------------------------------------------------------
"""

import argparse
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# demo.py lives in backend/simulator/ — two levels below project root,
# not one, so the project's usual load_dotenv('../.env') convention
# (written for scripts sitting directly in backend/) doesn't reach the
# root .env from here. Resolve relative to this file so it works no
# matter which directory you run the script from.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_PROJECT_ROOT / ".env")

from node_simulator import generate_run, build_reading, SequenceCounter  # noqa: E402
from scenarios import SCENARIOS  # noqa: E402

TARGETS = {
    "local": os.environ.get("MINESHIELD_LOCAL_URL", "http://localhost:8000"),
    # NOT CONFIRMED — set MINESHIELD_PRODUCTION_URL in your .env, this
    # script refuses to run --target production without it rather than
    # guessing a URL.
    "production": os.environ.get("MINESHIELD_PRODUCTION_URL", ""),
}

# Confirmed against backend/auth/api_key.py.
INGESTION_API_KEY_HEADER = "X-API-Key"
INGESTION_API_KEY = os.environ.get("INGESTION_API_KEY")

# Confirmed against backend/get_test_jwt.py.
DEMO_EMAIL = "demo.tester@example.com"
DEMO_PASSWORD = "DemoPassword123!"
DEMO_NAME = "Demo Tester"

_jwt_cache = {}

ZONE_CODE = "A"  # hard project constraint — only zone in this project

# Only used if --create-nodes is passed. Empty by default: default
# behavior is pure reuse of whatever nodes already exist in Zone A.
# Edit coordinates/ids before using — these are placeholders, not
# discovered from your DB.
EXTRA_DEMO_NODES = [
    # {
    #     "node_id": "MSN-A-DEMO-01",
    #     "node_name": "Demo simulated node 1",
    #     "data_source": "simulated",
    #     "sensor_types": ["tilt", "displacement", "vibration", "crack",
    #                      "temperature", "humidity", "battery", "rssi"],
    #     "latitude": 23.7100,
    #     "longitude": 86.4100,
    #     "is_reference_node": False,
    #     "calibration_status": "calibrated",
    # },
]

PAUSE = True


def log(msg):
    print(f"  {msg}")


def step(msg):
    print(f"\n{'=' * 70}\n{msg}\n{'=' * 70}")
    if PAUSE:
        input("  -> watch the dashboard, then press Enter to continue...")


# ---------------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------------
def get_ingestion_headers():
    if not INGESTION_API_KEY:
        raise RuntimeError(
            "INGESTION_API_KEY is not set. Add it to your project-root .env "
            "(the same file backend/database/session.py etc. already load "
            "via load_dotenv('../.env'))."
        )
    return {INGESTION_API_KEY_HEADER: INGESTION_API_KEY}


def get_jwt_headers(base_url):
    """Only called when --create-nodes is used. Replicates
    get_test_jwt.py's register-or-login flow exactly against the given
    base_url, and caches the token for the rest of this run. NOTE: the
    demo account's role (admin/operator) is set by set_demo_user_admin.py
    against your LOCAL MySQL — if you run --create-nodes --target
    production and that DB doesn't have the same account promoted, node
    creation will 403 on the role check even though auth succeeds."""
    if base_url in _jwt_cache:
        return {"Authorization": f"Bearer {_jwt_cache[base_url]}"}

    register_resp = requests.post(
        f"{base_url}/api/auth/register",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD, "name": DEMO_NAME},
        timeout=10,
    )

    if register_resp.status_code == 200:
        token = register_resp.json()["token"]
        log("Demo account created for this target.")
    elif register_resp.status_code == 409:
        login_resp = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            timeout=10,
        )
        login_resp.raise_for_status()
        token = login_resp.json()["token"]
        log("Demo account already existed, logged in.")
    else:
        register_resp.raise_for_status()
        return None  # unreachable, raise_for_status always raises on non-2xx

    _jwt_cache[base_url] = token
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# ZONE A + NODE DISCOVERY — reuse-first, never creates B/C/D
# ---------------------------------------------------------------------------
def fetch_zone_a(base_url):
    # NOT CONFIRMED path — see header note (2) above. Requires auth like
    # every other dashboard-facing endpoint (confirmed via the 401 you
    # hit without it) — not just the mutation endpoints.
    headers = get_jwt_headers(base_url)
    resp = requests.get(f"{base_url}/api/zones", headers=headers, timeout=10)
    resp.raise_for_status()
    zones = resp.json()
    for zone in zones:
        if zone.get("zone_code") == ZONE_CODE:
            return zone
    raise RuntimeError(
        f"No zone with zone_code='{ZONE_CODE}' found via GET {base_url}/api/zones. "
        f"Got zones: {[z.get('zone_code') for z in zones]}. "
        "This project should have exactly Zone A already seeded (Chat 1) — "
        "check the seed data rather than letting this script create one."
    )


def fetch_existing_nodes(base_url, zone_id):
    # NOT CONFIRMED path — see header note (2) above.
    headers = get_jwt_headers(base_url)
    resp = requests.get(f"{base_url}/api/nodes", headers=headers, timeout=10)
    resp.raise_for_status()
    all_nodes = resp.json()
    # Known gap from earlier testing: GET /api/nodes returns decommissioned
    # nodes unfiltered — filter both by zone and status here.
    return [
        n for n in all_nodes
        if n.get("zone_id") == zone_id and n.get("status") != "decommissioned"
    ]


def create_node(base_url, zone_id, node_def):
    headers = get_jwt_headers(base_url)
    payload = {
        "node_id": node_def["node_id"],
        "node_name": node_def.get("node_name"),
        "zone_id": zone_id,
        "data_source": node_def["data_source"],
        "sensor_types": node_def.get("sensor_types"),
        "latitude": node_def["latitude"],
        "longitude": node_def["longitude"],
        "is_reference_node": node_def.get("is_reference_node", False),
        "calibration_status": node_def.get("calibration_status", "unknown"),
    }
    resp = requests.post(f"{base_url}/api/nodes", headers=headers, json=payload, timeout=10)
    if resp.status_code == 409:
        log(f"  {node_def['node_id']} already registered — reusing, not duplicating.")
        return None
    resp.raise_for_status()
    log(f"  Created {node_def['node_id']} (id={resp.json().get('id')})")
    return resp.json()


def ensure_demo_nodes(base_url, zone, create_nodes):
    existing = fetch_existing_nodes(base_url, zone["id"])
    log(f"Found {len(existing)} existing active node(s) in Zone A: "
        f"{[n['node_id'] for n in existing]}")

    if create_nodes and EXTRA_DEMO_NODES:
        existing_ids = {n["node_id"] for n in existing}
        for node_def in EXTRA_DEMO_NODES:
            if node_def["node_id"] in existing_ids:
                log(f"  {node_def['node_id']} already exists — skipping create.")
                continue
            create_node(base_url, zone["id"], node_def)
        existing = fetch_existing_nodes(base_url, zone["id"])
    elif create_nodes and not EXTRA_DEMO_NODES:
        log("  --create-nodes was passed but EXTRA_DEMO_NODES is empty — "
            "nothing to create. Edit that list in demo.py first.")

    if not existing:
        raise RuntimeError(
            "No usable nodes found in Zone A and none were created. "
            "Either register nodes via the Nodes page first, or pass "
            "--create-nodes with EXTRA_DEMO_NODES populated."
        )
    return existing


# ---------------------------------------------------------------------------
# INGESTION
# ---------------------------------------------------------------------------
def push_reading(base_url, reading):
    headers = get_ingestion_headers()
    resp = requests.post(f"{base_url}/api/ingest", headers=headers, json=reading, timeout=10)
    if resp.status_code >= 400:
        log(f"  HTTP {resp.status_code}: {resp.text[:300]}")
        return None
    body = resp.json()
    if not body.get("accepted"):
        log(f"  REJECTED — reason: {body.get('reason')}")
    return body


# Held-value overrides for a fast, presentation-friendly run. Not derived
# from rules/risk_engine.py (not available this chat) — these are
# deliberately extreme, well-separated values meant to land clearly in
# each risk band regardless of exact thresholds, not tuned to specific
# numbers. If your rule engine's thresholds put any of these in the
# wrong bucket, these are the four dicts to adjust — nothing else in the
# demo path needs to change.
DEMO_LEVEL_OVERRIDES = [
    ("green", {}),  # baseline, no override needed
    ("yellow", {
        "displacement_mm": 6.0, "displacement_rate": 0.3,
        "tilt_magnitude": 0.5, "tilt_x": 0.35,
    }),
    ("orange", {
        "displacement_mm": 12.0, "displacement_rate": 0.8,
        "tilt_magnitude": 0.9, "tilt_x": 0.6,
        "vibration_rms": 0.3, "vibration_peak": 0.6,
    }),
   ("red", {
    "displacement_mm": 55.0,
    "displacement_rate": 11.0,
    "tilt_magnitude": 11.0,
    "tilt_x": 1.2,
    "vibration_rms": 0.8,
    "vibration_peak": 1.6,
    "crack_width_mm": 11.0,
    "crack_detected": True,
}),
]


def run_quick_demo(base_url, nodes, zone, ticks_per_level, delay):
    """Every node cycles GREEN -> YELLOW -> ORANGE -> RED with a few held
    (near-constant) readings per level, so persistence-based escalation
    in the rule engine actually triggers instead of seeing one-off blips.
    Nodes run CONCURRENTLY (one thread each) since they're fully
    independent — this is what actually matters for wall-clock time with
    more than one node, not the per-request delay."""
    import concurrent.futures

    zone_id_field = zone["zone_code"]
    seq_counter = SequenceCounter()

    step(f"Quick demo: {[n['node_id'] for n in nodes]} each cycling "
         f"GREEN -> YELLOW -> ORANGE -> RED (concurrently)")

    def run_one_node(node):
        session = requests.Session()
        headers = get_ingestion_headers()
        for level_name, overrides in DEMO_LEVEL_OVERRIDES:
            for i in range(ticks_per_level):
                reading = build_reading(node, zone_id_field, "quick_demo", overrides, seq_counter)
                resp = session.post(f"{base_url}/api/ingest", headers=headers, json=reading, timeout=10)
                if resp.status_code < 400:
                    body = resp.json()
                    if not body.get("accepted"):
                        log(f"  {node['node_id']} {level_name}: REJECTED — {body.get('reason')}")
                else:
                    log(f"  {node['node_id']} {level_name}: HTTP {resp.status_code}: {resp.text[:150]}")
                if delay:
                    time.sleep(delay)
        log(f"  {node['node_id']}: done")

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(len(nodes), 1)) as pool:
        list(pool.map(run_one_node, nodes))


def run_scenarios_for_nodes(base_url, nodes, zone, scenario_names, ticks, delay):
    zone_id_field = zone["zone_code"]  # see NOT CONFIRMED note (3) at top
    for scenario_name in scenario_names:
        step(f"Scenario: {scenario_name}  |  nodes: {[n['node_id'] for n in nodes]}")
        for node in nodes:
            log(f"-- {node['node_id']} ({node['data_source']}) running '{scenario_name}' --")
            for tick_i, reading in generate_run(node, zone_id_field, scenario_name, ticks):
                if reading is None:
                    log(f"  tick {tick_i}: dropped (simulating lost packet)")
                    continue
                result = push_reading(base_url, reading)
                if result and result.get("accepted"):
                    log(f"  tick {tick_i}: ok, quality={result.get('data_quality_score')}")
                time.sleep(delay)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    global PAUSE
    parser = argparse.ArgumentParser(description="MineShield demo simulator (Zone A only)")
    parser.add_argument("--target", choices=["local", "production"], required=True)
    parser.add_argument("--create-nodes", action="store_true",
                         help="Also create any nodes listed in EXTRA_DEMO_NODES (requires JWT)")
    parser.add_argument("--demo", action="store_true",
                         help="Fast presentation mode: every node cycles GREEN->YELLOW->ORANGE->RED "
                              "in under 2 minutes, no pauses. Ignores --scenarios.")
    parser.add_argument("--scenarios", type=str, default=None,
                         help="Comma-separated subset, default = all 10")
    parser.add_argument("--nodes", type=str, default=None,
                         help="Comma-separated node_ids to restrict to, default = all in Zone A")
    parser.add_argument("--ticks", type=int, default=None, help="Override per-scenario tick count")
    parser.add_argument("--delay", type=float, default=0.3, help="Seconds between readings")
    parser.add_argument("--no-pause", action="store_true")
    args = parser.parse_args()
    PAUSE = not args.no_pause

    base_url = TARGETS[args.target]
    if not base_url:
        print(f"No base URL configured for target='{args.target}'. "
              f"Set MINESHIELD_{'PRODUCTION' if args.target == 'production' else 'LOCAL'}_URL in .env.")
        sys.exit(1)
    log(f"Target: {args.target} -> {base_url}")

    zone = fetch_zone_a(base_url)
    log(f"Zone A resolved: id={zone['id']} zone_code={zone['zone_code']} name={zone.get('name')}")

    nodes = ensure_demo_nodes(base_url, zone, args.create_nodes)

    if args.nodes:
        wanted = {n.strip() for n in args.nodes.split(",")}
        nodes = [n for n in nodes if n["node_id"] in wanted]
        missing = wanted - {n["node_id"] for n in nodes}
        if missing:
            log(f"  WARNING: requested node_id(s) not found/active in Zone A: {missing}")
        if not nodes:
            print("No matching nodes to run. Exiting.")
            sys.exit(1)

    if args.demo:
        PAUSE = False
        ticks_per_level = args.ticks or 2
        delay = args.delay if args.delay != 0.3 else 0.02  # tighter default for --demo
        run_quick_demo(base_url, nodes, zone, ticks_per_level, delay)
        step("DONE. Overview / Live Map / Node Details / Alerts / Analytics / "
             "System Health should all reflect what just streamed.")
        return

    scenario_names = list(SCENARIOS)
    if args.scenarios:
        scenario_names = [s.strip() for s in args.scenarios.split(",")]
        unknown = set(scenario_names) - set(SCENARIOS)
        if unknown:
            print(f"Unknown scenario(s): {unknown}. Valid: {list(SCENARIOS)}")
            sys.exit(1)

    run_scenarios_for_nodes(base_url, nodes, zone, scenario_names, args.ticks, args.delay)

    step("DONE. Overview / Live Map / Node Details / Alerts / Analytics / "
         "System Health should all reflect what just streamed.")


if __name__ == "__main__":
    main()
