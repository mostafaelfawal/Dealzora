"""قواعد العمل للأقسام ووحدات القياس. كل أمر كتابة = معاملة واحدة + Audit + Outbox.

- حذف قسم: أصنافه تصبح "بدون قسم" في نفس المعاملة.
- إعادة تسمية وحدة: تتغير على كل الأصناف التي تستخدمها في نفس المعاملة.
- حذف وحدة مستخدمة: ممنوع.
"""

from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.errors import ConflictError, NotFoundError
from app.core.outbox import OutboxOp
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.snapshots import diff_snapshots
from app.modules.products.model import Category, Product
from app.modules.products.service import ProductService

from .constants import (
    CATEGORY_MESSAGES,
    CATEGORY_SNAPSHOT_FIELDS,
    ENTITY_CATEGORY,
    ENTITY_MEASURE_UNIT,
    UNIT_MESSAGES,
    UNIT_SNAPSHOT_FIELDS,
    CategoryError,
    UnitError,
)
from .model import MeasureUnit
from .registry import enqueue_unit, seed_units_if_empty
from .repository import CatalogRepository
from .schema import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    MeasureUnitCreate,
    MeasureUnitOut,
    MeasureUnitUpdate,
)


class CategoryService(EntityService):
    entity = ENTITY_CATEGORY
    messages = CATEGORY_MESSAGES
    version_conflict_error = CategoryError.VERSION_CONFLICT
    unique_conflict_error = CategoryError.NAME_TAKEN
    snapshot_fields = CATEGORY_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = CatalogRepository(session)

    def list_categories(self) -> list[CategoryOut]:
        return [self._to_out(c, n) for c, n in self.repo.list_categories()]

    def create_category(self, data: CategoryCreate) -> CategoryOut:
        self._check_name(data.name)
        category = Category(
            id=uuid7(),
            name=data.name,
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
        )
        self.session.add(category)
        self.repo.flush()
        self._audit(category, "create", self._snapshot(category))
        self._enqueue(category, base_version=None)
        self._commit()
        return self._to_out(category, 0)

    def update_category(self, category_id: str, data: CategoryUpdate) -> CategoryOut:
        category = self._get_or_404(category_id)
        self._check_version(category, data.base_version)
        self._check_name(data.name, exclude_id=category.id)
        if data.name != category.name:
            before = self._snapshot(category)
            category.name = data.name
            category.mark_modified()
            self._audit(category, "update", diff_snapshots(before, self._snapshot(category)))
            self._enqueue(category, base_version=data.base_version)
            self._commit()
        return self._to_out(category, self.repo.count_category_products(category.id))

    def delete_category(self, category_id: str, base_version: int) -> None:
        category = self._get_or_404(category_id)
        self._check_version(category, base_version)
        products = self.repo.products_in_category(category.id)

        def detach(product: Product) -> None:
            product.category_id = None

        ProductService(self.session, self.actor).cascade_update(products, detach)
        self._soft_delete(
            category, base_version, {"name": category.name, "detached_products": len(products)}
        )

    # ---------- داخلي ----------
    def _get_or_404(self, category_id: str) -> Category:
        category = self.repo.get_category(category_id)
        if category is None:
            raise self._err(NotFoundError, CategoryError.NOT_FOUND)
        return category

    def _check_name(self, name: str, exclude_id: str | None = None) -> None:
        if self.repo.category_name_taken(name, exclude_id):
            raise self._err(ConflictError, CategoryError.NAME_TAKEN)

    @staticmethod
    def _to_out(c: Category, product_count: int) -> CategoryOut:
        return CategoryOut(id=c.id, name=c.name, product_count=product_count, version=c.version)


class MeasureUnitService(EntityService):
    entity = ENTITY_MEASURE_UNIT
    messages = UNIT_MESSAGES
    version_conflict_error = UnitError.VERSION_CONFLICT
    unique_conflict_error = UnitError.NAME_TAKEN
    snapshot_fields = UNIT_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = CatalogRepository(session)

    def list_units(self) -> list[MeasureUnitOut]:
        if seed_units_if_empty(self.session, self.actor):
            self._commit()
        counts = self.repo.unit_usage_counts()
        return [self._to_out(u, counts.get(u.name, 0)) for u in self.repo.list_units()]

    def create_unit(self, data: MeasureUnitCreate) -> MeasureUnitOut:
        seed_units_if_empty(self.session, self.actor)
        self._check_name(data.name)
        unit = MeasureUnit(
            id=uuid7(),
            name=data.name,
            allow_decimal=data.allow_decimal,
            sort_order=len(self.repo.list_units()),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
        )
        self.session.add(unit)
        self.repo.flush()
        self._audit(unit, "create", self._snapshot(unit))
        self._enqueue(unit, base_version=None)
        self._commit()
        return self._to_out(unit, 0)

    def update_unit(self, unit_id: str, data: MeasureUnitUpdate) -> MeasureUnitOut:
        unit = self._get_or_404(unit_id)
        self._check_version(unit, data.base_version)
        self._check_name(data.name, exclude_id=unit.id)

        old_name = unit.name
        if data.name != old_name:
            self._rename_on_products(old_name, data.name)

        before = self._snapshot(unit)
        unit.name = data.name
        unit.allow_decimal = data.allow_decimal
        after = self._snapshot(unit)
        if after != before:
            unit.mark_modified()
            self._audit(unit, "update", diff_snapshots(before, after))
            self._enqueue(unit, base_version=data.base_version)
            self._commit()
        return self._to_out(unit, self.repo.unit_usage_counts().get(unit.name, 0))

    def delete_unit(self, unit_id: str, base_version: int) -> None:
        unit = self._get_or_404(unit_id)
        self._check_version(unit, base_version)
        used = self.repo.unit_usage_counts().get(unit.name, 0)
        if used:
            raise self._err(ConflictError, UnitError.IN_USE, product_count=used)
        self._soft_delete(unit, base_version, {"name": unit.name})

    # ---------- داخلي ----------
    def _rename_on_products(self, old: str, new: str) -> None:
        products = self.repo.products_using_unit(old)
        for product in products:
            names = [product.unit, *(u.name for u in product.units)]
            if new in names:  # الصنف فيه الاسم الجديد كوحدة أخرى → يصبح مكرراً
                raise self._err(ConflictError, UnitError.NAME_CLASH, product=product.name)

        def rename(product: Product) -> None:
            if product.unit == old:
                product.unit = new
            for u in product.units:
                if u.name == old:
                    u.name = new
                    u.mark_modified()

        ProductService(self.session, self.actor).cascade_update(products, rename)

    def _enqueue(self, row: MeasureUnit, *, base_version: int | None, op: OutboxOp = OutboxOp.UPSERT) -> None:
        enqueue_unit(self.session, self.actor, row, base_version=base_version, op=op)

    def _get_or_404(self, unit_id: str) -> MeasureUnit:
        unit = self.repo.get_unit(unit_id)
        if unit is None:
            raise self._err(NotFoundError, UnitError.NOT_FOUND)
        return unit

    def _check_name(self, name: str, exclude_id: str | None = None) -> None:
        if self.repo.unit_name_taken(name, exclude_id):
            raise self._err(ConflictError, UnitError.NAME_TAKEN)

    @staticmethod
    def _to_out(u: MeasureUnit, product_count: int) -> MeasureUnitOut:
        return MeasureUnitOut(
            id=u.id,
            name=u.name,
            allow_decimal=u.allow_decimal,
            product_count=product_count,
            version=u.version,
        )
