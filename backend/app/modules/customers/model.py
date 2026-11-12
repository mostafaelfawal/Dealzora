"""جداول SQLAlchemy. المال بالقروش."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import (
    MAX_ADDRESS_LEN,
    MAX_NAME_LEN,
    MAX_NOTE_LEN,
    MAX_NOTES_LEN,
    MAX_PHONE_LEN,
)


class Customer(SyncMixin, Base):
    __tablename__ = "customers"

    name: Mapped[str] = mapped_column(String(MAX_NAME_LEN))
    search_text: Mapped[str] = mapped_column(Text, default="")  # اسم + هاتف (مُطبَّع) للبحث
    phone: Mapped[str | None] = mapped_column(String(MAX_PHONE_LEN), nullable=True)
    address: Mapped[str] = mapped_column(String(MAX_ADDRESS_LEN), default="")
    notes: Mapped[str] = mapped_column(String(MAX_NOTES_LEN), default="")
    credit_limit: Mapped[int] = mapped_column(Integer, default=0)  # 0 = نقدي فقط
    # أرصدة مخزّنة مؤقتاً لسرعة القوائم. المرجع الحقيقي = CustomerLedgerEntry،
    # وتُحدَّث هنا فقط داخل نفس معاملة تسجيل الحركة (ولا تغيّر version).
    balance: Mapped[int] = mapped_column(Integer, default=0)  # موجب = عليه دين
    total_sales: Mapped[int] = mapped_column(Integer, default=0)
    last_purchase_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_payment_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # عميل جملة: يأخذ سعر الجملة على كل صنف له سعر جملة، أياً كانت الكمية.
    is_wholesale: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        Index(
            "uq_customers_phone_live",
            "phone",
            unique=True,
            sqlite_where=text("deleted_at IS NULL AND phone IS NOT NULL"),
        ),
        Index("ix_customers_name", "name"),
        Index("ix_customers_balance", "balance"),
        Index("ix_customers_live_active", "deleted_at", "is_active"),
    )


class CustomerLedgerEntry(SyncMixin, Base):
    """كشف حساب العميل. append-only: التصحيح بحركة عكسية."""

    __tablename__ = "customer_ledger"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"))
    entry_type: Mapped[str] = mapped_column(String(24))
    debit: Mapped[int] = mapped_column(Integer, default=0)  # يزيد الدين
    credit: Mapped[int] = mapped_column(Integer, default=0)  # ينقص الدين
    balance_after: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    ref_type: Mapped[str | None] = mapped_column(String(24), nullable=True)  # sale / return ...
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (Index("ix_customer_ledger_customer", "customer_id", "id"),)
