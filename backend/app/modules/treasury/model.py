"""جدول حركات الخزنة. المال بالقروش. الرصيد = مجموع الداخل - مجموع الخارج (لا يُخزَّن)."""

from datetime import date

from sqlalchemy import Date, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_NOTE_LEN


class CashEntry(SyncMixin, Base):
    __tablename__ = "cash_entries"

    direction: Mapped[str] = mapped_column(String(3))  # in / out
    kind: Mapped[str] = mapped_column(String(24))
    amount: Mapped[int] = mapped_column(Integer)  # قروش، دائماً > 0
    occurred_at: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    source_entity: Mapped[str | None] = mapped_column(String(40), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (
        Index("ix_cash_live_date", "deleted_at", "occurred_at"),
        Index("ix_cash_source", "source_entity", "source_id", unique=True),
    )