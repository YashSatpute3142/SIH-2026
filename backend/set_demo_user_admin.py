from dotenv import load_dotenv
load_dotenv('../.env')
from database.session import engine
from sqlalchemy import text

conn = engine.connect()
conn.execute(
    text("UPDATE users SET role = 'admin' WHERE email = :email"),
    {"email": "demo.tester@example.com"},
)
conn.commit()

result = conn.execute(
    text("SELECT id, email, role FROM users WHERE email = :email"),
    {"email": "demo.tester@example.com"},
)
for row in result:
    print(row)
conn.close()
