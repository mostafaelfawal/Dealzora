"""إعدادات عامة للنظام (مفتاح ← قيمة). صف لكل إعداد، والمفاتيح في constants.SettingKey.

جدول مستقل بدل أعمدة في shop: create_all ينشئه في القواعد القائمة بدون migration.
"""

from sqlalchemy import Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin


class AppSetting(SyncMixin, Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64))
    value: Mapped[str] = mapped_column(Text, default="")

    __table_args__ = (
        Index("uq_app_settings_key_live", "key", unique=True, sqlite_where=text("deleted_at IS NULL")),
    )
