"""قراءة إعداد الضريبة من القاعدة (الحفظ في settings/service.py مع باقي الإعدادات)."""

from sqlalchemy.orm import Session

from .config import TaxConfig


def load_config(session: Session) -> TaxConfig:
    from app.modules.settings.service import SettingsService  # متأخر: لا دوران

    return SettingsService(session).tax()
