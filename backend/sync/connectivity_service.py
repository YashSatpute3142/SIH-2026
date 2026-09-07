import logging

from sqlalchemy.orm import Session

from models.settings_models import SystemSetting

logger = logging.getLogger(__name__)

INTERNET_STATUS_KEY = "internet_online"


def is_internet_online(db: Session) -> bool:
    setting = db.query(SystemSetting).filter_by(setting_key=INTERNET_STATUS_KEY).first()
    if setting is None:
        logger.warning(
            "Missing '%s' setting row, defaulting to online. Run the system_settings migration.",
            INTERNET_STATUS_KEY,
        )
        return True
    return setting.setting_value.lower() == "true"


def set_internet_status(db: Session, online: bool) -> SystemSetting:
    setting = db.query(SystemSetting).filter_by(setting_key=INTERNET_STATUS_KEY).first()

    if setting is None:
        setting = SystemSetting(setting_key=INTERNET_STATUS_KEY, setting_value=str(online).lower())
        db.add(setting)
    else:
        setting.setting_value = str(online).lower()

    db.commit()
    db.refresh(setting)

    logger.info("Internet status set to online=%s", online)
    return setting
