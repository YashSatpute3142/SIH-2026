import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base

DB_HOST = os.getenv("DB_HOST", "localhost").strip().rstrip(";")
DB_PORT = os.getenv("DB_PORT", "3306").strip().rstrip(";")
DB_NAME = os.getenv("DB_NAME", "mine_subsidence_system").strip().rstrip(";")
DB_USER = quote_plus(os.getenv("DB_USER", "root").strip())
DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD", "").strip())

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

Base = declarative_base()
