"""جداول سيرفر المزامنة.

- shops / branches: المحلات (العملاء) وفروعها، ولكل فرع سر دخول (مُجزّأ).
- events: سجل الأحداث القادمة من outbox كل فرع. id = معرّف الحدث في الفرع (يمنع التكرار)،
  و seq رقم متسلسل داخل المحل يُعطى تحت قفل صف المحل، فلا فجوات ولا ترتيب مقلوب.
  target_branch_id: حدث موجّه لفرع واحد (مثل التحويلات) لا يراه باقي الفروع.
- transfers: تحويلات المخزون وطلباتها (الحالة يملكها السيرفر ويتحقق من كل انتقال).
- daily_stats: ملخص يومي لكل فرع (لتقارير المالك المجمعة).
- pairing_codes: أكواد ربط جهاز الفرع (مرة واحدة، صلاحية قصيرة، مُجزّأة).
- catalog_items: الأصناف والعملاء المشتركين بين الفروع (نسخة واحدة لكل سجل، وseq لكل تغيير).
- audit_log: سجل أمني (دخول فاشل، ربط أجهزة، عمليات الإدارة، التحويلات).
"""

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, JSONType, utcnow


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # آخر رقم حدث أُعطي (يُزاد تحت قفل الصف).
    last_seq: Mapped[int] = mapped_column(BigInteger, default=0)
    last_transfer_no: Mapped[int] = mapped_column(Integer, default=0)
    # آخر رقم تغيير في كتالوج الأصناف والعملاء المشترك (عدّاد منفصل عن الأحداث).
    last_catalog_seq: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    # تسجيل ذاتي بترخيص «سلسلة»: محل واحد لكل ترخيص، ويتوقف بعد انتهاء الترخيص (بمهلة).
    # المحلات اللي أنشأها المورّد يدوياً بلا ترخيص هنا (لا انتهاء).
    license_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    license_plan: Mapped[str | None] = mapped_column(String(16), nullable=True)
    license_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # عدد أجهزة الكاشير في ترخيص المحل: يرثه كل فرع مع الخطة (عبر الشهادة).
    license_terminals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    branches: Mapped[list["Branch"]] = relationship(back_populates="shop", order_by="Branch.created_at")


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(12))  # بادئة ترقيم الفرع (MA، NC…)
    secret_hash: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_pushed_seq: Mapped[int] = mapped_column(BigInteger, default=0)
    # آخر حدث أكّد الفرع أنه طبّقه محلياً (للمراقبة وحذف القديم لاحقاً).
    acked_seq: Mapped[int] = mapped_column(BigInteger, default=0)
    # يزيد مع تغيير السر أو الربط: كل التوكنات القديمة تتوقف فوراً.
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    # الفرع الرئيسي (جهاز المالك): يدير فروع محله وأكواد ربطها من البرنامج نفسه.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    shop: Mapped[Shop] = relationship(back_populates="branches")

    __table_args__ = (UniqueConstraint("shop_id", "code", name="uq_branches_shop_code"),)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"))
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    seq: Mapped[int] = mapped_column(BigInteger)
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(64))
    op: Mapped[str] = mapped_column(String(16))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONType)
    base_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # None = لكل فروع المحل. غير ذلك = لهذا الفرع فقط (خصوصية بين الفروع).
    target_branch_id: Mapped[str | None] = mapped_column(
        ForeignKey("branches.id"), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("shop_id", "seq", name="uq_events_shop_seq"),
        Index("ix_events_entity", "shop_id", "entity", "entity_id"),
    )


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # من الفرع (يمنع التكرار)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"))
    number: Mapped[int] = mapped_column(Integer)
    from_branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    to_branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    status: Mapped[str] = mapped_column(String(16))
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    receive_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sent_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    received_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # طلب تحويل (فرع الاستلام يطلب، وفرع الإرسال يوافق ويرسل أو يرفض).
    requested_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)

    lines: Mapped[list["TransferLine"]] = relationship(
        back_populates="transfer", order_by="TransferLine.position", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("shop_id", "number", name="uq_transfers_shop_number"),
        Index("ix_transfers_to", "to_branch_id", "status"),
        Index("ix_transfers_from", "from_branch_id", "status"),
    )


class TransferLine(Base):
    __tablename__ = "transfer_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    transfer_id: Mapped[str] = mapped_column(ForeignKey("transfers.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    product_id: Mapped[str] = mapped_column(String(36))
    # لمطابقة الصنف في الفرع الآخر لو اختلف الـ id (الباركود ثم الاسم).
    barcode: Mapped[str | None] = mapped_column(String(32), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(30))
    qty_sent: Mapped[int] = mapped_column(BigInteger)  # × 1000 (نفس قاعدة البرنامج)
    qty_requested: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # للطلبات
    qty_received: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    unit_cost: Mapped[int] = mapped_column(BigInteger, default=0)  # قروش
    batch_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    transfer: Mapped[Transfer] = relationship(back_populates="lines")


class DailyStat(Base):
    __tablename__ = "daily_stats"

    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), index=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PairingCode(Base):
    """كود قصير يكتبه المالك في برنامج الفرع مرة واحدة، فيأخذ الجهاز سرّه بدون نسخ نصوص طويلة."""

    __tablename__ = "pairing_codes"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    actor: Mapped[str] = mapped_column(String(16))  # admin / branch / anonymous
    action: Mapped[str] = mapped_column(String(40))
    shop_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    branch_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)


class CatalogItem(Base):
    """سجل مشترك (صنف أو عميل) بين فروع المحل. id = المعرّف العام (gid) الموحّد في كل الفروع.

    match_key: مفتاح الدمج عند أول ربط (باركود الصنف أو اسمه، رقم تليفون العميل) فلا يتكرر
    نفس الصنف لو كان موجوداً في فرعين قبل الربط. فريد بين السجلات غير المحذوفة (يُفحص تحت قفل المحل).
    المخزون والتكلفة والأرصدة لا تُخزّن هنا أبداً: كل فرع له أرقامه.
    """

    __tablename__ = "catalog_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"))
    kind: Mapped[str] = mapped_column(String(16))  # product / customer
    match_key: Mapped[str | None] = mapped_column(String(240), nullable=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    seq: Mapped[int] = mapped_column(BigInteger)
    updated_by_branch_id: Mapped[str | None] = mapped_column(ForeignKey("branches.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_catalog_items_shop_seq", "shop_id", "seq"),
        Index("ix_catalog_items_shop_key", "shop_id", "kind", "match_key"),
    )
