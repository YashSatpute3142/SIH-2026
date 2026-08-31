from dotenv import load_dotenv
load_dotenv("../.env")

from database.base import engine, Base
from models.user import User
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT 1"))
    print("Connection OK:", result.scalar())

with engine.connect() as conn:
    tables = conn.execute(text("SHOW TABLES")).fetchall()
    print("Tables found:", [t[0] for t in tables])
