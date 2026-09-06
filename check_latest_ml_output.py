import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import text
from database.session import SessionLocal

db = SessionLocal()
try:
    print("Latest risk row:")
    row = db.execute(
        text(
            "SELECT id, node_id, risk_level, rule_triggered, ml_risk_class, ml_probability, anomaly_score "
            "FROM risks ORDER BY id DESC LIMIT 1"
        )
    ).fetchone()
    print(" ", row)

    print("\nLatest anomaly row:")
    row = db.execute(
        text(
            "SELECT id, node_id, detected_at, anomaly_score, anomaly_status, model_version "
            "FROM anomalies ORDER BY id DESC LIMIT 1"
        )
    ).fetchone()
    print(" ", row)

    print("\nLatest prediction row:")
    row = db.execute(
        text(
            "SELECT id, node_id, predicted_at, horizon_hours, predicted_displacement_mm, trend_direction, "
            "confidence, model_name, model_version FROM predictions ORDER BY id DESC LIMIT 1"
        )
    ).fetchone()
    print(" ", row)
finally:
    db.close()
