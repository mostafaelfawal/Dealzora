"""حجوزات العملاء: أصناف يحجزها العميل ويستلمها لاحقاً، بعربون اختياري.

الحجز ليس بيعاً: لا يخصم مخزوناً ولا يدخل التقارير. الأصناف محفوظة كما في شاشة الكاشير
(مثل الفواتير المعلّقة) وتُسعَّر من جديد عند الاستلام. العربون يُضاف لرصيد العميل لدى المحل
ويدخل درج الوردية، ثم يُدفع منه في فاتورة الاستلام.
"""

from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_NOTE_LEN


class Reservation(SyncMixin, Base):
    __tablename__ = "reservations"

    number: Mapped[int] = mapped_column(Integer, unique=True)
    # مفتاح من الواجهة يمنع حفظ نفس الحجز مرتين (ضغطتين أو إعادة إرسال).
    client_ref: Mapped[str] = mapped_column(String(36), unique=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    customer_name: Mapped[str] = mapped_column(String(100))
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    search_text: Mapped[str] = mapped_column(String(300), default="")  # الاسم والهاتف مُطبَّعين
    status: Mapped[str] = mapped_column(String(12))
    pickup_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # الفاتورة كما في شاشة الكاشير (أصناف وخصم). عرض واسترجاع فقط، لا نثق بأسعارها.
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)  # قروش، تقديري وقت الحجز
    deposit: Mapped[int] = mapped_column(Integer, default=0)  # قروش
    # الوردية التي دخل درجها العربون (لحساب الكاش المتوقع عند القفل).
    deposit_shift_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    sale_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (Index("ix_reservations_status", "status", "pickup_on"),)
