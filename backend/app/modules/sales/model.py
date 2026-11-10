"""جداول المبيعات والمرتجعات. المال بالقروش، الكميات × 1000.

الفاتورة لا تُعدَّل ولا تُحذف بعد الحفظ (append-only): التصحيح بمرتجع.
كل سطر يحمل لقطة (الاسم/السعر/التكلفة وقت البيع) فلا تتأثر التقارير بتعديل الصنف لاحقاً.
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, SyncMixin

from .constants import MAX_NOTE_LEN


class Sale(SyncMixin, Base):
    __tablename__ = "sales"

    number: Mapped[int] = mapped_column(Integer, unique=True)
    # مفتاح من الواجهة يمنع حفظ نفس الفاتورة مرتين (ضغطتين أو إعادة إرسال).
    client_ref: Mapped[str] = mapped_column(String(36), unique=True)
    shift_id: Mapped[str | None] = mapped_column(ForeignKey("shifts.id"), nullable=True)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sold_on: Mapped[date] = mapped_column(Date)  # يوم الجهاز المحلي (للتقارير)
    payment_method: Mapped[str] = mapped_column(String(8))
    subtotal: Mapped[int] = mapped_column(Integer)  # قبل أي خصم
    lines_discount: Mapped[int] = mapped_column(Integer, default=0)
    invoice_discount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    cash_amount: Mapped[int] = mapped_column(Integer, default=0)  # الجزء الكاش من الإجمالي
    credit_amount: Mapped[int] = mapped_column(Integer, default=0)  # الجزء الآجل
    received: Mapped[int] = mapped_column(Integer, default=0)  # ما سلّمه العميل فعلاً
    change: Mapped[int] = mapped_column(Integer, default=0)
    cost_total: Mapped[int] = mapped_column(Integer, default=0)
    returned_total: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)

    lines: Mapped[list["SaleLine"]] = relationship(
        back_populates="sale", lazy="selectin", order_by="SaleLine.id"
    )

    __table_args__ = (
        Index("ix_sales_sold_on", "sold_on"),
        Index("ix_sales_customer", "customer_id"),
        Index("ix_sales_shift", "shift_id"),
    )


class SaleLine(SyncMixin, Base):
    __tablename__ = "sale_lines"

    sale_id: Mapped[str] = mapped_column(ForeignKey("sales.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    unit_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    unit_name: Mapped[str] = mapped_column(String(30))
    factor: Mapped[int] = mapped_column(Integer, default=1000)  # وحدات أساسية × 1000 لكل وحدة بيع
    qty: Mapped[int] = mapped_column(Integer)  # بوحدة البيع × 1000
    unit_price: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)  # خصم السطر بالقروش
    line_total: Mapped[int] = mapped_column(Integer)  # بعد خصم السطر
    net_total: Mapped[int] = mapped_column(Integer)  # بعد توزيع خصم الفاتورة (= المدفوع فعلاً)
    unit_cost: Mapped[int] = mapped_column(Integer, default=0)  # تكلفة الوحدة الأساسية وقت البيع
    cost_total: Mapped[int] = mapped_column(Integer, default=0)
    returned_qty: Mapped[int] = mapped_column(Integer, default=0)
    returned_amount: Mapped[int] = mapped_column(Integer, default=0)

    sale: Mapped[Sale] = relationship(back_populates="lines")


class SaleReturn(SyncMixin, Base):
    __tablename__ = "sale_returns"

    number: Mapped[int] = mapped_column(Integer, unique=True)
    sale_id: Mapped[str] = mapped_column(ForeignKey("sales.id"), index=True)
    shift_id: Mapped[str | None] = mapped_column(ForeignKey("shifts.id"), nullable=True)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    returned_on: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(String(24))
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    total: Mapped[int] = mapped_column(Integer)
    cash_refund: Mapped[int] = mapped_column(Integer, default=0)  # خرج من الدرج
    credit_refund: Mapped[int] = mapped_column(Integer, default=0)  # خُصم من دين العميل
    cost_total: Mapped[int] = mapped_column(Integer, default=0)

    lines: Mapped[list["SaleReturnLine"]] = relationship(
        back_populates="sale_return", lazy="selectin", order_by="SaleReturnLine.id"
    )

    __table_args__ = (Index("ix_sale_returns_on", "returned_on"),)


class SaleReturnLine(SyncMixin, Base):
    __tablename__ = "sale_return_lines"

    return_id: Mapped[str] = mapped_column(ForeignKey("sale_returns.id"), index=True)
    sale_line_id: Mapped[str] = mapped_column(ForeignKey("sale_lines.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String(200))
    unit_name: Mapped[str] = mapped_column(String(30))
    qty: Mapped[int] = mapped_column(Integer)  # بوحدة البيع × 1000
    amount: Mapped[int] = mapped_column(Integer)
    cost_total: Mapped[int] = mapped_column(Integer, default=0)

    sale_return: Mapped[SaleReturn] = relationship(back_populates="lines")
