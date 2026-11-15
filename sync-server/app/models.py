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
- mobile_codes / mobile_sessions: ربط هاتف المالك أو المدير بالمحل، وجلسة لكل هاتف (refresh مُجزّأ).
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


class MobileCode(Base):
    """كود ربط الهاتف بالمحل: يحدد المحل فقط (أسماء المستخدمين فريدة داخل المحل وحده).
    مرة واحدة، صلاحية قصيرة، مُجزّأ، ويُبطَل بعد محاولات كلمة مرور خاطئة كثيرة."""

    __tablename__ = "mobile_codes"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), index=True)
    # الفرع اللي طلب الكود (None = الإدارة).
    created_by_branch_id: Mapped[str | None] = mapped_column(ForeignKey("branches.id"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MobileSession(Base):
    """جلسة هاتف واحد لحساب واحد (مالك أو مدير). الحساب نفسه سجل في الكتالوج (owner / staff).

    refresh_hash: تجزئة توكن التجديد الحالي فقط (يتغير مع كل تجديد، والقديم لو رجع = سرقة ← إلغاء الجلسة).
    cred_fp: بصمة تجزئة كلمة المرور وقت الدخول: تغيير كلمة المرور من البرنامج يُلغي جلسات الهاتف.
    """

    __tablename__ = "mobile_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("catalog_items.id"))
    username: Mapped[str] = mapped_column(String(50))
    device_id: Mapped[str] = mapped_column(String(64))
    device_name: Mapped[str] = mapped_column(String(80))
    platform: Mapped[str] = mapped_column(String(16))
    refresh_hash: Mapped[str] = mapped_column(String(64))
    refresh_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cred_fp: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # logout / logout_all / replaced / refresh_reuse / expired / account_changed
    revoke_reason: Mapped[str | None] = mapped_column(String(24), nullable=True)
    # Expo push token لهذا الهاتف (يُمسح مع الخروج أو إلغاء الجلسة).
    push_token: Mapped[str | None] = mapped_column(String(200), nullable=True)

    __table_args__ = (Index("ix_mobile_sessions_account", "account_id", "revoked_at"),)


class TransferCommand(Base):
    """إجراء طلبه الهاتف وينفّذه جهاز الفرع نفسه (الموافقة تحتاج مخزون الفرع وتكلفته ودفعاته).

    pending ← ينتظر الفرع · executing ← الفرع استلمه ويخصم المخزون · done ← وصلت موافقة الفرع للسيرفر
    failed ← الفرع لم يقدر (مخزون، صنف غير معروف…) · superseded ← الطلب تغيّر قبل التنفيذ (رفض/سحب/موافقة مباشرة)
    expired ← لم يأخذه الفرع خلال المهلة (منقطع أو إصدار قديم) · cancelled ← ألغاه صاحبه من الهاتف
    """

    __tablename__ = "transfer_commands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"))
    transfer_id: Mapped[str] = mapped_column(ForeignKey("transfers.id"), index=True)
    # الفرع المنفّذ (المطلوب منه).
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    action: Mapped[str] = mapped_column(String(16))
    body: Mapped[dict[str, Any]] = mapped_column(JSONType)
    transfer_version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16))
    requested_by: Mapped[str] = mapped_column(String(50))
    account_id: Mapped[str] = mapped_column(String(36))
    session_id: Mapped[str] = mapped_column(String(36))
    device_name: Mapped[str] = mapped_column(String(80))
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_transfer_commands_branch", "branch_id", "status"),)


class NotificationPrefs(Base):
    """إعدادات تنبيهات حساب (لكل الهواتف): الأنواع المفعّلة، مدة الانقطاع، ساعات الهدوء، وفرق توقيت الهاتف."""

    __tablename__ = "notification_prefs"

    account_id: Mapped[str] = mapped_column(ForeignKey("catalog_items.id"), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), index=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    utc_offset_minutes: Mapped[int] = mapped_column(Integer, default=120, server_default="120")
    # آخر إشعار push أُرسل للحساب (للتجميع: لا أكثر من واحد كل بضع دقائق).
    last_push_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    """تنبيه لحساب واحد. dedup_key فريد لكل حساب: نفس الحدث لا يُنشأ مرتين أبداً.

    pending ← ينتظر الإرسال (تجميع/ساعات هدوء) · sent ← أُرسل (أو سُجّل في التطبيق بلا هاتف مسجّل)
    dropped ← لم يعد صحيحاً قبل الإرسال (الفرع رجع، الطلب اتحسم…) ويبقى في السجل غير مرسل.
    """

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"))
    account_id: Mapped[str] = mapped_column(ForeignKey("catalog_items.id"))
    kind: Mapped[str] = mapped_column(String(24))
    dedup_key: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(String(200))
    # شاشة التطبيق عند الضغط (مسار expo-router).
    route: Mapped[str] = mapped_column(String(120))
    # مرجع للتحقق قبل الإرسال (فرع/تحويل) — بلا أي بيانات حساسة.
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("account_id", "dedup_key", name="uq_notifications_account_key"),
        Index("ix_notifications_account_created", "account_id", "created_at"),
        Index("ix_notifications_status", "status"),
    )


class BranchReport(Base):
    """لقطة حالية يرفعها الفرع (تُستبدل كاملة): النواقص، القريب من الانتهاء، ومخزون الأصناف المطلوبة.
    أرقام وأسماء أصناف فقط — لا مخزون كامل ولا بيانات عملاء."""

    __tablename__ = "branch_reports"

    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), index=True)
    data: Mapped[list[Any]] = mapped_column(JSONType)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BranchRecord(Base):
    """سجل من الفرع (يُحدَّث بنفس المفتاح): إغلاق وردية، عملية حساسة، الأكثر مبيعاً ليوم."""

    __tablename__ = "branch_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"))
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    key: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(12))
    day: Mapped[date] = mapped_column(Date)
    at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("branch_id", "key", name="uq_branch_records_branch_key"),
        Index("ix_branch_records_shop_kind_day", "shop_id", "kind", "day"),
    )


class ShopReportConfig(Base):
    """حدود يحددها المالك (العمليات الحساسة، فرق النقدية، أيام الصلاحية) وتصل للفروع مع المزامنة."""

    __tablename__ = "shop_report_config"

    shop_id: Mapped[str] = mapped_column(ForeignKey("shops.id"), primary_key=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
