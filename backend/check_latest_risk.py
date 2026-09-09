from dotenv import load_dotenv
load_dotenv('../.env')
from database.session import engine
from sqlalchemy import text

conn = engine.connect()
result = conn.execute(text("SELECT id, risk_level, ml_risk_class, contributing_features FROM risks ORDER BY id DESC LIMIT 1"))
for row in result:
    print(row)
conn.close()
