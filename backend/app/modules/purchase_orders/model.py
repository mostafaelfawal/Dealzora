"""طلبات الشراء (قبل وصول البضاعة). لا تمس المخزون ولا الحسابات:
المخزون والمورد والخزنة تتحرك فقط عند تحويل الطلب لفاتورة شراء. المال بالقروش، الكميات × 1000."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, SyncMixin

from .constants import MAX_NOTE_LEN, OrderStatus


class PurchaseOrder(SyncMixin, Base):
    __tablename__ = "purchase_orders"

    number: Mapped[int] = mapped_column(Integer, unique=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), index=True)
    supplier_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(16), default=OrderStatus.DRAFT.value)
    total: Mapped[int] = mapped_column(Integer, default=0)  # تقديري بآخر سعر شراء
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purchase_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="order",
        lazy="selectin",
        order_by="PurchaseOrderLine.id",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_purchase_orders_status", "status"),)


class PurchaseOrderLine(SyncMixin, Base):
    __tablename__ = "purchase_order_lines"

    order_id: Mapped[str] = mapped_column(ForeignKey("purchase_orders.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    unit_name: Mapped[str] = mapped_column(String(30))
    qty: Mapped[int] = mapped_column(Integer)  # بالوحدة الأساسية × 1000
    unit_cost: Mapped[int] = mapped_column(Integer)  # تقديري للوحدة الأساسية
    line_total: Mapped[int] = mapped_column(Integer)
    stock_at_order: Mapped[int] = mapped_column(Integer, default=0)  # الرصيد وقت الطلب (للمراجعة)

    order: Mapped[PurchaseOrder] = relationship(back_populates="lines")
