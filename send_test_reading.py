import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")

API_KEY = os.getenv("INGESTION_API_KEY")
BASE_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

if not API_KEY:
    print("INGESTION_API_KEY not found in .env - cannot send a test reading")
    sys.exit(1)

payload = {
    "node_id": "NODE-A-01",
    "zone_id": "A",
    "data_source": "simulated",
    "sequence_number": 9999,
    "tilt_x": 0.05,
    "tilt_y": 0.03,
    "tilt_magnitude": 0.06,
    "displacement_mm": 8.0,
    "displacement_rate": 0.1,
    "vibration_rms": 0.05,
    "vibration_peak": 0.07,
    "vibration_variance": 0.0005,
    "crack_width_mm": 0.5,
    "crack_detected": False,
    "temperature": 25.0,
    "humidity": 50.0,
    "battery_voltage": 3.9,
    "rssi": -60,
    "packet_loss": 0.01,
    "sensor_status": "ok",
    "calibration_status": "calibrated",
}

response = httpx.post(
    f"{BASE_URL}/api/ingest",
    json=payload,
    headers={"X-API-Key": API_KEY},
    timeout=10.0,
)

print("Status code:", response.status_code)
print("Response body:", response.json())
