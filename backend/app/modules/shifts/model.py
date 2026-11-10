"""جدول الورديات. المال بالقروش. وردية واحدة مفتوحة فقط على الجهاز (درج واحد)."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin, utcnow

from .constants import MAX_NOTE_LEN


class Shift(SyncMixin, Base):
    __tablename__ = "shifts"

    cashier_id: Mapped[str] = mapped_column(String(36), index=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    opening_float: Mapped[int] = mapped_column(Integer, default=0)  # فكّة بداية الوردية
    # تُجمَّد عند القفل (أثناء الوردية تُحسب لحظياً من المبيعات والمرتجعات).
    expected_cash: Mapped[int | None] = mapped_column(Integer, nullable=True)
    counted_cash: Mapped[int | None] = mapped_column(Integer, nullable=True)
    difference: Mapped[int | None] = mapped_column(Integer, nullable=True)  # موجب = زيادة
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)

    __table_args__ = (
        # يمنع فتح ورديتين معاً حتى لو وصل طلبان في نفس اللحظة.
        Index(
            "uq_shifts_single_open",
            "is_open",
            unique=True,
            sqlite_where=text("is_open = 1 AND deleted_at IS NULL"),
        ),
        Index("ix_shifts_opened", "opened_at"),
    )
