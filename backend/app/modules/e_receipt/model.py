"""سلسلة الإيصالات لكل جهاز: آخر UUID ورقم تسلسلي متزايد (previousUUID للإيصال التالي).

محلي بالكامل (لا Outbox ولا مزامنة): السلسلة ملك الجهاز الأساسي الذي يصدر إيصالاته وإيصالات أجهزة
الكاشير المقترنة به. التحديث داخل نفس معاملة البيع، والمعاملة تبدأ BEGIN IMMEDIATE (core/database.py)
فالبيعات المتزامنة على نفس الجهاز تمر بالدور؛ وفوق ذلك التحديث مشروط (compare-and-swap) على last_seq.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, utcnow, uuid7


class EReceiptChain(Base):
    __tablename__ = "e_receipt_chains"

    pos_device_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    last_seq: Mapped[int] = mapped_column(Integer, default=0)  # 0 = لم يصدر الجهاز إيصالاً بعد
    last_uuid: Mapped[str] = mapped_column(String(64), default="")  # "" = أول إيصال (previousUUID فارغ)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class EReceiptAttempt(Base):
    """سجل تشخيص لكل اتصال بالمنظومة (مصادقة/اختبار/إرسال/متابعة) ونتيجته. محلي، بلا أسرار ولا مستندات:
    فقط الحالة والأعداد والـ correlationId ورسالة مختصرة."""

    __tablename__ = "e_receipt_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid7)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    pos_device_id: Mapped[str] = mapped_column(String(36), index=True)
    environment: Mapped[str] = mapped_column(String(10))
    operation: Mapped[str] = mapped_column(String(10))  # test / submit / poll
    outcome: Mapped[str] = mapped_column(String(16))  # ok / partial / rejected / network / rate_limited / auth_failed / bad_request
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submission_uuid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    receipts_count: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    retry_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
