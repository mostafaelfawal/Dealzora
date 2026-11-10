"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.products.model import Category, Product, ProductUnit

from .model import MeasureUnit

_LIVE_PRODUCT = Product.deleted_at.is_(None)


class CatalogRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- الأقسام ----------
    def list_categories(self) -> list[tuple[Category, int]]:
        counts = (
            select(Product.category_id, func.count().label("n"))
            .where(_LIVE_PRODUCT)
            .group_by(Product.category_id)
            .subquery()
        )
        stmt = (
            select(Category, func.coalesce(counts.c.n, 0))
            .outerjoin(counts, counts.c.category_id == Category.id)
            .where(Category.deleted_at.is_(None))
            .order_by(Category.sort_order, Category.name)
        )
        return [(c, n) for c, n in self.session.execute(stmt).all()]

    def get_category(self, category_id: str) -> Category | None:
        stmt = select(Category).where(Category.id == category_id, Category.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def category_name_taken(self, name: str, exclude_id: str | None = None) -> bool:
        stmt = select(Category.id).where(Category.name == name, Category.deleted_at.is_(None))
        if exclude_id:
            stmt = stmt.where(Category.id != exclude_id)
        return self.session.scalar(stmt.limit(1)) is not None

    def count_category_products(self, category_id: str) -> int:
        stmt = select(func.count()).select_from(Product).where(
            _LIVE_PRODUCT, Product.category_id == category_id
        )
        return self.session.scalar(stmt) or 0

    def products_in_category(self, category_id: str) -> list[Product]:
        stmt = select(Product).where(_LIVE_PRODUCT, Product.category_id == category_id)
        return list(self.session.scalars(stmt).all())

    # ---------- الوحدات ----------
    def list_units(self) -> list[MeasureUnit]:
        stmt = (
            select(MeasureUnit)
            .where(MeasureUnit.deleted_at.is_(None))
            .order_by(MeasureUnit.sort_order, MeasureUnit.name)
        )
        return list(self.session.scalars(stmt).all())

    def get_unit(self, unit_id: str) -> MeasureUnit | None:
        stmt = select(MeasureUnit).where(MeasureUnit.id == unit_id, MeasureUnit.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def unit_name_taken(self, name: str, exclude_id: str | None = None) -> bool:
        stmt = select(MeasureUnit.id).where(MeasureUnit.name == name, MeasureUnit.deleted_at.is_(None))
        if exclude_id:
            stmt = stmt.where(MeasureUnit.id != exclude_id)
        return self.session.scalar(stmt.limit(1)) is not None

    def unit_usage_counts(self) -> dict[str, int]:
        """عدد الأصناف الحية التي تستخدم كل اسم وحدة (أساسية أو إضافية)."""
        base = select(Product.id.label("pid"), Product.unit.label("name")).where(_LIVE_PRODUCT)
        extra = (
            select(ProductUnit.product_id.label("pid"), ProductUnit.name.label("name"))
            .join(Product, Product.id == ProductUnit.product_id)
            .where(_LIVE_PRODUCT, ProductUnit.deleted_at.is_(None))
        )
        both = base.union(extra).subquery()  # union يحذف التكرار (صنف + اسم)
        stmt = select(both.c.name, func.count()).group_by(both.c.name)
        return {name: n for name, n in self.session.execute(stmt).all()}

    def products_using_unit(self, name: str) -> list[Product]:
        extra_ids = select(ProductUnit.product_id).where(
            ProductUnit.name == name, ProductUnit.deleted_at.is_(None)
        )
        stmt = select(Product).where(
            _LIVE_PRODUCT, or_(Product.unit == name, Product.id.in_(extra_ids))
        )
        return list(self.session.scalars(stmt).all())

    def flush(self) -> None:
        self.session.flush()
