from sqlalchemy import (
    Column,
    BigInteger,
    String,
    DateTime,
    func,
)

from database.base import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    setting_key = Column(String(100), nullable=False, unique=True)
    setting_value = Column(String(255), nullable=False)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, nullable=False, server_default=func.now())
