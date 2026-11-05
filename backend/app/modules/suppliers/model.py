"""جداول SQLAlchemy. المال بالقروش. الرصيد الموجب = مستحق للمورد علينا."""

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_ADDRESS_LEN, MAX_NAME_LEN, MAX_NOTE_LEN, MAX_NOTES_LEN, MAX_PHONE_LEN


class Supplier(SyncMixin, Base):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String(MAX_NAME_LEN))
    search_text: Mapped[str] = mapped_column(Text, default="")  # اسم + هاتف (مُطبَّع) للبحث
    phone: Mapped[str | None] = mapped_column(String(MAX_PHONE_LEN), nullable=True)
    address: Mapped[str | None] = mapped_column(String(MAX_ADDRESS_LEN), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(MAX_NOTES_LEN), nullable=True)
    # رصيد مخزّن لسرعة القوائم. المرجع الحقيقي = مجموع SupplierTransaction.amount_delta،
    # ويُحدَّث هنا فقط داخل نفس معاملة تسجيل الحركة (ولا يرفع version).
    balance: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        Index(
            "uq_suppliers_name_live",
            "name",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_suppliers_live_active", "deleted_at", "is_active"),
    )


class SupplierTransaction(SyncMixin, Base):
    """كشف حساب المورد (Supplier Ledger). append-only: التصحيح بحركة عكسية."""

    __tablename__ = "supplier_transactions"

    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"))
    txn_type: Mapped[str] = mapped_column(String(24))
    amount_delta: Mapped[int] = mapped_column(Integer)  # موقّعة: + يزيد المستحق، - ينقصه
    balance_after: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    ref_type: Mapped[str | None] = mapped_column(String(24), nullable=True)  # purchase ...
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (Index("ix_supplier_txn_supplier", "supplier_id", "id"),)
