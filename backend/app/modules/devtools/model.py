"""سجل البيانات التجريبية: كل صف أنشأه المولّد (اسم الجدول + id) حتى يُحذف بدقة لاحقاً."""

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, uuid7


class DemoRecord(Base):
    __tablename__ = "demo_records"

    # UUIDv7 مرتب زمنياً = ترتيب الإنشاء، فالحذف بالعكس يحترم المفاتيح الأجنبية.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid7)
    table_name: Mapped[str] = mapped_column(String(64))
    row_id: Mapped[str] = mapped_column(String(64))

    __table_args__ = (Index("ix_demo_records_table", "table_name"),)
