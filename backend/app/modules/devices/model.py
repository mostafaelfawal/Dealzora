"""أجهزة الكاشير المقترنة بهذا الجهاز الأساسي. id الجهاز = device_id الذي يُسجَّل على عملياته
(الوردية، الفواتير...)، فكل جهاز له درجه ووردياته المستقلة."""

from datetime import datetime

from sqlalchemy import DateTime, Index, String, text
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
