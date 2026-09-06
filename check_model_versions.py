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
    rows = db.execute(
        text("SELECT model_name, version, is_active, trained_at FROM model_versions ORDER BY model_name, trained_at")
    ).fetchall()
    for row in rows:
        print(row)
finally:
    db.close()
