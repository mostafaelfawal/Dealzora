"""نسخة محلية من التحويلات التي حرّكت مخزون هذا الفرع.

السيرفر يملك حالة التحويل، لكن المخزون محلي: هذا الجدول يضمن أن كل تحويل يحرك المخزون
**مرة واحدة فقط** (stock_out_applied / stock_in_applied / stock_reversed)، وأن الإرسال الذي
فشل بسبب انقطاع النت يُعاد تلقائياً (pending) بدل أن يضيع والمخزون مخصوم.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, utcnow


class BranchTransfer(Base):
    __tablename__ = "branch_transfers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # نفس id التحويل على السيرفر
    direction: Mapped[str] = mapped_column(String(4))  # out = أرسلنا / in = استلمنا أو طلبنا
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    other_branch_id: Mapped[str] = mapped_column(String(36))
    other_branch_name: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(16))  # حالة السيرفر، أو pending / failed محلياً
    # عملية لم تصل للسيرفر بعد: {"op": "create"|"approve", "body": {...}}
    pending: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    stock_out_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    stock_in_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    stock_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    # سطر السيرفر ← صنف محلي (عند الاستلام أو الموافقة).
    mapping: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    # الأسطر كما خرجت من مخزوننا (لعكسها بدقة عند الإلغاء أو الفشل).
    out_lines: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CatalogLink(Base):
    """ربط سجل محلي (صنف/عميل) بسجله العام على سيرفر الفروع (gid).

    synced: آخر بيانات مشتركة متفق عليها مع السيرفر. الفرق بينها وبين السجل المحلي = تعديلاتنا
    اللي لسه ما اترفعتش (تُرفع كحقول فقط، فلا تمسح تعديلات فرع آخر على حقول تانية).
    gid فارغ = سجل محلي فشل رفعه (error)، و remote = تغيير من السيرفر فشل تطبيقه (يُعاد).
    """

    __tablename__ = "branch_catalog_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))  # product / customer
    local_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    gid: Mapped[str | None] = mapped_column(String(36), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=0)
    synced: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    remote: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("uq_branch_catalog_links_local", "kind", "local_id", unique=True),
        Index("uq_branch_catalog_links_gid", "kind", "gid", unique=True),
    )


class CatalogState(Base):
    """مؤشر مزامنة الكتالوج (صف واحد). branch_id مختلف = الجهاز اتربط بفرع/محل آخر: نبدأ من الصفر."""

    __tablename__ = "branch_catalog_state"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(36))
    after: Mapped[int] = mapped_column(BigInteger, default=0)  # آخر seq سحبناه
    scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
