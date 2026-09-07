from dotenv import load_dotenv
load_dotenv("../.env")

from database.session import engine
from sqlalchemy import text

with open("../migration_system_settings.sql", "r", encoding="utf-8") as f:
    raw_lines = f.readlines()

cleaned_lines = [line for line in raw_lines if not line.strip().startswith("--")]
sql_text = "".join(cleaned_lines)

statements = [s.strip() for s in sql_text.split(";") if s.strip()]

with engine.connect() as conn:
    for stmt in statements:
        conn.execute(text(stmt))
    conn.commit()

print(f"migration applied, statements executed: {len(statements)}")
