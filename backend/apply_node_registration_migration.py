from dotenv import load_dotenv
load_dotenv('../.env')
from database.session import engine
from sqlalchemy import text

conn = engine.connect()
conn.execute(text("ALTER TABLE sensor_nodes ADD COLUMN node_name VARCHAR(255) NULL AFTER node_id"))
conn.execute(text("ALTER TABLE sensor_nodes ADD COLUMN sensor_types JSON NULL AFTER data_source"))
conn.commit()
conn.close()
print("migration applied")
