"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from .constants import QTY_SCALE
from .helper import escape_like, normalize_search
from .model import Category, Product, ProductUnit, StockMovement
from .types import ProductFilters, ProductsSummary, SortKey, StockFilter

_OUT = Product.stock_qty <= 0
_LOW = and_(Product.stock_qty > 0, Product.min_stock > 0, Product.stock_qty <= Product.min_stock)
_MARGIN = (Product.sale_price - Product.cost_price) * 1.0 / func.nullif(Product.sale_price, 0)

_ORDER = {
    SortKey.NAME_ASC: (Product.name.asc(),),
    SortKey.NEWEST: (Product.id.desc(),),  # UUIDv7 مرتب زمنياً
    SortKey.PRICE_ASC: (Product.sale_price.asc(), Product.name.asc()),
    SortKey.PRICE_DESC: (Product.sale_price.desc(), Product.name.asc()),
    SortKey.STOCK_ASC: (Product.stock_qty.asc(), Product.name.asc()),
    SortKey.STOCK_DESC: (Product.stock_qty.desc(), Product.name.asc()),
    SortKey.MARGIN_DESC: (_MARGIN.desc(), Product.name.asc()),
}


class ProductRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- قراءة ----------
    def get(self, product_id: str) -> Product | None:
        stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def find_by_barcode(self, barcode: str) -> tuple[Product, ProductUnit | None] | None:
        stmt = select(Product).where(Product.barcode == barcode, Product.deleted_at.is_(None))
        if product := self.session.scalars(stmt).first():
            return product, None
        unit_stmt = select(ProductUnit).where(
            ProductUnit.barcode == barcode, ProductUnit.deleted_at.is_(None)
        )
        if unit := self.session.scalars(unit_stmt).first():
            if product := self.get(unit.product_id):
                return product, unit
        return None

    def barcode_taken(self, barcode: str, *, exclude_product_id: str | None = None) -> bool:
        p = select(Product.id).where(Product.barcode == barcode, Product.deleted_at.is_(None))
        u = select(ProductUnit.id).where(
            ProductUnit.barcode == barcode, ProductUnit.deleted_at.is_(None)
        )
        if exclude_product_id:
            p = p.where(Product.id != exclude_product_id)
            u = u.where(ProductUnit.product_id != exclude_product_id)
        return (
            self.session.scalar(p.limit(1)) is not None
            or self.session.scalar(u.limit(1)) is not None
        )

    @staticmethod
    def _conditions(filters: ProductFilters) -> list:
        conds = [Product.deleted_at.is_(None)]
        if filters.only_active:
            conds.append(Product.is_active.is_(True))
        if filters.category_id:
            conds.append(Product.category_id == filters.category_id)
        if term := normalize_search(filters.query):
            conds.append(Product.search_text.like(f"%{escape_like(term)}%", escape="\\"))
        if filters.stock is StockFilter.OUT:
            conds.append(_OUT)
        elif filters.stock is StockFilter.LOW:
            conds.append(_LOW)
        return conds

    def list_products(self, filters: ProductFilters) -> tuple[list[Product], int]:
        conds = self._conditions(filters)
        total = self.session.scalar(select(func.count()).select_from(Product).where(*conds)) or 0
        stmt = (
            select(Product)
            .where(*conds)
            .order_by(*_ORDER[filters.sort], Product.id)
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )
        return list(self.session.scalars(stmt).all()), total

    def summary(self) -> ProductsSummary:
        active = Product.is_active.is_(True)
        stmt = select(
            func.count(),
            func.coalesce(func.sum(case((and_(active, _LOW), 1), else_=0)), 0),
            func.coalesce(func.sum(case((and_(active, _OUT), 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case((Product.stock_qty > 0, Product.stock_qty * Product.cost_price // QTY_SCALE), else_=0)
                ),
                0,
            ),
        ).where(Product.deleted_at.is_(None))
        total, low, out, value = self.session.execute(stmt).one()
        return ProductsSummary(total=total, low=low, out=out, stock_value=value)

    def catalog_version(self) -> str:
        """بصمة رخيصة لكل ما تعرضه شاشة الكاشير (أصناف، وحداتها، أقسام، عملاء).
        تتغير مع أي إضافة أو تعديل أو حذف (الحذف ناعم: يرفع version و updated_at).
        أجهزة الكاشير تسأل عنها كل ثوانٍ وتعيد التحميل الكامل فقط عند تغيّرها."""
        from app.modules.customers.model import Customer  # متأخر: لا اعتماد دائري

        parts = []
        for model in (Product, ProductUnit, Category, Customer):
            count, versions, latest = self.session.execute(
                select(func.count(), func.coalesce(func.sum(model.version), 0), func.max(model.updated_at))
            ).one()
            parts.append(f"{count}:{versions}:{latest.isoformat() if latest else '-'}")
        return "|".join(parts)

    def get_category(self, category_id: str) -> Category | None:
        stmt = select(Category).where(Category.id == category_id, Category.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def list_movements(self, product_id: str, page: int, page_size: int) -> tuple[list[StockMovement], int]:
        cond = StockMovement.product_id == product_id
        total = self.session.scalar(select(func.count()).select_from(StockMovement).where(cond)) or 0
        stmt = (
            select(StockMovement)
            .where(cond)
            .order_by(StockMovement.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.session.scalars(stmt).all()), total

    # ---------- كتابة ----------
    def add(self, product: Product) -> None:
        self.session.add(product)

    def add_movement(self, movement: StockMovement) -> None:
        self.session.add(movement)

    def flush(self) -> None:
        self.session.flush()
