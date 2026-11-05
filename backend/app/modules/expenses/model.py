"""جدول SQLAlchemy. المال بالقروش."""

from datetime import date

from sqlalchemy import Date, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_CATEGORY_LEN, MAX_NOTE_LEN


class Expense(SyncMixin, Base):
    __tablename__ = "expenses"

    category: Mapped[str] = mapped_column(String(MAX_CATEGORY_LEN))
    amount: Mapped[int] = mapped_column(Integer)  # قروش
    spent_at: Mapped[date] = mapped_column(Date)  # تاريخ المصروف (يوم محلي)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    search_text: Mapped[str] = mapped_column(Text, default="")  # الملاحظة مُطبَّعة للبحث

    __table_args__ = (
        Index("ix_expenses_live_date", "deleted_at", "spent_at"),
        Index("ix_expenses_category", "category"),
    )