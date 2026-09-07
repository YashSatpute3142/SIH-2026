import os
import requests
from dotenv import load_dotenv

load_dotenv("../.env")

BASE_URL = "http://localhost:8000"
API_KEY = os.getenv("INGESTION_API_KEY")

reading = {
    "node_id": "NODE-A-01",
    "zone_id": "A",
    "reading_timestamp": "2026-09-06 18:05:00",
    "sequence_number": 99999,
    "data_source": "simulated",
    "tilt_x": 0.5,
    "tilt_y": 0.3,
    "tilt_magnitude": 0.58,
    "displacement_mm": 12.5,
    "displacement_rate": 0.1,
    "vibration_rms": 0.02,
    "vibration_peak": 0.05,
    "vibration_variance": 0.001,
    "crack_width_mm": 0.0,
    "crack_detected": False,
    "temperature": 24.5,
    "humidity": 60.0,
    "battery_voltage": 3.7,
    "rssi": -65,
    "packet_loss": 0.0,
    "sensor_status": "ok",
    "calibration_status": "calibrated",
}

headers = {"X-API-Key": API_KEY} if API_KEY else {}

response = requests.post(f"{BASE_URL}/api/ingest", json=reading, headers=headers)
print("Status code:", response.status_code)
print("Raw response text:", response.text)
try:
    print("Parsed JSON:", response.json())
except Exception:
    print("(response was not valid JSON)")
