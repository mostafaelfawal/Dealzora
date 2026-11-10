"""جداول المشتريات ومرتجعها. المال بالقروش، الكميات × 1000. append-only."""

from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, SyncMixin

from .constants import MAX_NOTE_LEN, MAX_REF_LEN


class Purchase(SyncMixin, Base):
    __tablename__ = "purchases"

    number: Mapped[int] = mapped_column(Integer, unique=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), index=True)
    supplier_name: Mapped[str] = mapped_column(String(200))
    supplier_invoice: Mapped[str | None] = mapped_column(String(MAX_REF_LEN), nullable=True)
    purchased_on: Mapped[date] = mapped_column(Date)
    subtotal: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    paid_amount: Mapped[int] = mapped_column(Integer, default=0)
    credit_amount: Mapped[int] = mapped_column(Integer, default=0)
    returned_total: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)

    lines: Mapped[list["PurchaseLine"]] = relationship(
        back_populates="purchase", lazy="selectin", order_by="PurchaseLine.id"
    )

    __table_args__ = (Index("ix_purchases_on", "purchased_on"),)


class PurchaseLine(SyncMixin, Base):
    __tablename__ = "purchase_lines"

    purchase_id: Mapped[str] = mapped_column(ForeignKey("purchases.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    unit_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    unit_name: Mapped[str] = mapped_column(String(30))
    factor: Mapped[int] = mapped_column(Integer, default=1000)
    qty: Mapped[int] = mapped_column(Integer)  # بوحدة الشراء × 1000
    unit_cost: Mapped[int] = mapped_column(Integer)  # سعر وحدة الشراء كما في فاتورة المورد
    line_total: Mapped[int] = mapped_column(Integer)
    net_total: Mapped[int] = mapped_column(Integer)  # بعد توزيع خصم الفاتورة
    base_cost: Mapped[int] = mapped_column(Integer)  # تكلفة الوحدة الأساسية الفعلية (بعد الخصم)
    returned_qty: Mapped[int] = mapped_column(Integer, default=0)
    returned_amount: Mapped[int] = mapped_column(Integer, default=0)

    purchase: Mapped[Purchase] = relationship(back_populates="lines")


class PurchaseReturn(SyncMixin, Base):
    __tablename__ = "purchase_returns"

    number: Mapped[int] = mapped_column(Integer, unique=True)
    purchase_id: Mapped[str] = mapped_column(ForeignKey("purchases.id"), index=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"))
    returned_on: Mapped[date] = mapped_column(Date)
    refund_method: Mapped[str] = mapped_column(String(8))
    total: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)

    lines: Mapped[list["PurchaseReturnLine"]] = relationship(
        back_populates="purchase_return", lazy="selectin", order_by="PurchaseReturnLine.id"
    )


class PurchaseReturnLine(SyncMixin, Base):
    __tablename__ = "purchase_return_lines"

    return_id: Mapped[str] = mapped_column(ForeignKey("purchase_returns.id"), index=True)
    purchase_line_id: Mapped[str] = mapped_column(ForeignKey("purchase_lines.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String(200))
    qty: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(Integer)

    purchase_return: Mapped[PurchaseReturn] = relationship(back_populates="lines")
