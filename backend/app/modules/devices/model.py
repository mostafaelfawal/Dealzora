"""أجهزة الكاشير المقترنة بهذا الجهاز الأساسي. id الجهاز = device_id الذي يُسجَّل على عملياته
(الوردية، الفواتير...)، فكل جهاز له درجه ووردياته المستقلة."""

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin


class Device(SyncMixin, Base):
    __tablename__ = "devices"

    name: Mapped[str] = mapped_column(String(60))
    # sha256 للتوكن فقط؛ التوكن نفسه لا يُخزَّن هنا (يبقى على جهاز الكاشير).
    token_hash: Mapped[str] = mapped_column(String(64))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # الإلغاء = deleted_at (من SyncMixin): التوكن يتوقف فوراً.

    __table_args__ = (
        Index("uq_devices_token_live", "token_hash", unique=True, sqlite_where=text("deleted_at IS NULL")),
    )


class DeviceEtaProfile(SyncMixin, Base):
    """بيانات الجهاز في منظومة الإيصال الإلكتروني (صف لكل جهاز يصدر إيصالات: الأساسي وأجهزة الكاشير).

    pos_device_id = Device.id لجهاز الكاشير، أو device_id الجهاز الأساسي (POS_DEVICE_ID).
    (device_id من SyncMixin = الجهاز الذي أنشأ الصف، وليس الجهاز الموصوف.)

    الأسرار (client_secret وpresharedkey) مشفّرة بـ core/secret_box.py ولا ترجع في أي API،
    ولا تدخل المزامنة (لا Outbox لهذا الجدول) ولا سجل التدقيق بقيمتها.
    أسماء الحقول المقابلة في الـ SDK (01-authenticate-pos):
      pos_serial ← header posserial (وهو deviceSerialNumber في الإيصال)
      pos_os_version ← header pososversion ، pos_model_framework ← header posmodelframework
      client_id / client_secret ← body ، preshared_key ← header presharedkey
    """

    __tablename__ = "device_eta_profiles"

    pos_device_id: Mapped[str] = mapped_column(String(36))
    pos_serial: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pos_os_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pos_model_framework: Mapped[str | None] = mapped_column(String(10), nullable=True)
    client_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    preshared_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "uq_device_eta_profiles_device_live",
            "pos_device_id",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
