"""جداول SQLAlchemy. المال بالقروش، الكميات × 1000."""

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, SyncMixin

from .constants import MAX_BARCODE_LEN, MAX_NAME_LEN, MAX_NOTE_LEN, MAX_UNIT_NAME_LEN


class Category(SyncMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(80))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index("uq_categories_name_live", "name", unique=True, sqlite_where=text("deleted_at IS NULL")),
    )


class Product(SyncMixin, Base):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(MAX_NAME_LEN))
    search_text: Mapped[str] = mapped_column(Text, default="")  # اسم + باركودات (مُطبَّع) للبحث
    barcode: Mapped[str | None] = mapped_column(String(MAX_BARCODE_LEN), nullable=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    unit: Mapped[str] = mapped_column(String(MAX_UNIT_NAME_LEN))
    allow_decimal: Mapped[bool] = mapped_column(Boolean, default=False)
    cost_price: Mapped[int] = mapped_column(Integer, default=0)
    sale_price: Mapped[int] = mapped_column(Integer)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    # رصيد مخزّن مؤقتاً لسرعة القوائم. المرجع الحقيقي = مجموع StockMovement.qty_delta،
    # ويُحدَّث هنا فقط داخل نفس معاملة تسجيل الحركة.
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[Category | None] = relationship(lazy="joined")
    all_units: Mapped[list["ProductUnit"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductUnit.id",
    )

    __table_args__ = (
        Index(
            "uq_products_barcode_live",
            "barcode",
            unique=True,
            sqlite_where=text("deleted_at IS NULL AND barcode IS NOT NULL"),
        ),
        Index("ix_products_name", "name"),
        Index("ix_products_category", "category_id"),
        Index("ix_products_live_active", "deleted_at", "is_active"),
    )

    @property
    def units(self) -> list["ProductUnit"]:
        """الوحدات الإضافية غير المحذوفة."""
        return [u for u in self.all_units if u.deleted_at is None]


class ProductUnit(SyncMixin, Base):
    """وحدة بيع إضافية (كرتونة/دستة). المخزون يُحسب دائماً بالوحدة الأساسية."""

    __tablename__ = "product_units"

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    name: Mapped[str] = mapped_column(String(MAX_UNIT_NAME_LEN))
    factor: Mapped[int] = mapped_column(Integer)  # عدد الوحدات الأساسية × 1000
    barcode: Mapped[str | None] = mapped_column(String(MAX_BARCODE_LEN), nullable=True)
    sale_price: Mapped[int | None] = mapped_column(Integer, nullable=True)

    product: Mapped[Product] = relationship(back_populates="all_units")

    __table_args__ = (
        Index(
            "uq_product_units_barcode_live",
            "barcode",
            unique=True,
            sqlite_where=text("deleted_at IS NULL AND barcode IS NOT NULL"),
        ),
    )


class StockMovement(SyncMixin, Base):
    """دفتر حركة المخزون (Stock Ledger). append-only: التصحيح بحركة عكسية."""

    __tablename__ = "stock_movements"

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    movement_type: Mapped[str] = mapped_column(String(24))
    qty_delta: Mapped[int] = mapped_column(Integer)  # موقّعة، × 1000
    balance_after: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)  # سعر الشراء وقت الحركة
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)
    ref_type: Mapped[str | None] = mapped_column(String(24), nullable=True)  # sale / purchase ...
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (Index("ix_stock_movements_product", "product_id", "id"),)
