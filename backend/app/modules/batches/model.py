"""دفعات الأصناف (Lots) وتواريخ صلاحيتها.

- ProductBatch: كمية دخلت بتاريخ صلاحية واحد (من فاتورة شراء، رصيد افتتاحي، جرد بالزيادة…).
- BatchMove: نصيب كل دفعة من حركة مخزون (موقّع)، فنعرف أي دفعة باع منها كل فاتورة
  ونرجّع المرتجع لنفس الدفعات.

للصنف المتتبَّع: مجموع qty_remaining للدفعات = رصيد الصنف (stock_qty).
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, SyncMixin


class ProductBatch(SyncMixin, Base):
    __tablename__ = "product_batches"

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    batch_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    qty_in: Mapped[int] = mapped_column(Integer)  # × 1000
    qty_remaining: Mapped[int] = mapped_column(Integer)  # × 1000
    unit_cost: Mapped[int] = mapped_column(Integer, default=0)  # تكلفة الوحدة الأساسية
    received_on: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(24))  # نوع الحركة التي أنشأتها
    ref_type: Mapped[str | None] = mapped_column(String(24), nullable=True)
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (
        Index("ix_batches_product", "product_id", "qty_remaining"),
        Index("ix_batches_expiry", "expiry_date"),
    )


class BatchMove(SyncMixin, Base):
    __tablename__ = "batch_moves"

    batch_id: Mapped[str] = mapped_column(ForeignKey("product_batches.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36))
    movement_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    qty: Mapped[int] = mapped_column(Integer)  # موقّعة × 1000
    ref_type: Mapped[str | None] = mapped_column(String(24), nullable=True)
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # المستند الأصلي: الفاتورة لمرتجعها، وفاتورة الشراء لمرتجع الشراء.
    origin_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # العلاقة تجعل SQLAlchemy يُدخل الدفعة قبل حركاتها في نفس الـ flush.
    batch: Mapped[ProductBatch] = relationship(lazy="noload")

    __table_args__ = (Index("ix_batch_moves_ref", "ref_type", "ref_id", "product_id"),)
