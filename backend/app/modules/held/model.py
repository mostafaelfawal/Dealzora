"""الفواتير المعلّقة على الجهاز الأساسي: تظهر وتُسترجع من أي جهاز كاشير في المحل.

ليست بيعاً: لا تخصم مخزوناً ولا تدخل التقارير ولا الخزنة. مسودة فقط بالسعر وقت التعليق
(السيرفر يراجع الأسعار عند الدفع كالعادة). تُحذف تلقائياً عند قفل الوردية التي عُلّقت فيها.
"""

from typing import Any

from sqlalchemy import JSON, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin


class HeldInvoice(SyncMixin, Base):
    __tablename__ = "held_invoices"

    shift_id: Mapped[str] = mapped_column(String(36), index=True)
    # الفاتورة كما في شاشة الكاشير (أصناف، عميل، خصم). عرض واسترجاع فقط.
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)  # قروش، للعرض في القائمة
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    __table_args__ = (Index("ix_held_live", "deleted_at", "created_at"),)
