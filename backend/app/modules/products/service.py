"""قواعد العمل. كل أمر كتابة = معاملة واحدة: المنتج + الحركة + Audit + Outbox ثم commit واحد."""

from typing import Any

from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.bulk import BulkIn, BulkResultOut
from app.core.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.snapshots import diff_snapshots
from app.core.text import build_search_text, normalize_digits

from .constants import (
    COPY_SUFFIX,
    ENTITY_PRODUCT,
    ENTITY_STOCK_MOVEMENT,
    ERROR_MESSAGES,
    MAX_NAME_LEN,
    QTY_SCALE,
    ProductError,
)
from .helper import (
    calc_margin_percent,
    calc_stock_level,
    compute_adjustment,
    product_snapshot,
)
from .model import Product, ProductUnit, StockMovement
from .repository import ProductRepository
from .schema import (
    BarcodeLookupOut,
    CategoryOut,
    LedgerQuery,
    ProductBase,
    ProductCreate,
    ProductListOut,
    ProductListQuery,
    ProductOut,
    ProductsSummaryOut,
    ProductUpdate,
    StockAdjustIn,
    StockLedgerOut,
    StockMovementOut,
    UnitIn,
    UnitOut,
)
from .types import MovementType, ProductFilters, SortKey


class ProductService(EntityService):
    entity = ENTITY_PRODUCT
    messages = ERROR_MESSAGES
    version_conflict_error = ProductError.VERSION_CONFLICT
    unique_conflict_error = ProductError.BARCODE_TAKEN

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = ProductRepository(session)

    # ---------- لقطات: المنتج بوحداته (override لأساس EntityService) ----------
    def _snapshot(self, row: Any) -> dict[str, Any]:
        return product_snapshot(row)

    def _outbox_snapshot(self, row: Any) -> dict[str, Any]:
        return product_snapshot(row, include_deleted_units=True)  # الوحدات المحذوفة تُنشر للمزامنة

    # ================= قراءة =================
    def list_products(self, query: ProductListQuery) -> ProductListOut:
        if query.sort is SortKey.MARGIN_DESC and not self.is_manager:
            raise ForbiddenError("forbidden", "الترتيب بهامش الربح للمدير فقط")

        filters = ProductFilters(
            query=query.q,
            category_id=query.category_id,
            stock=query.stock,
            sort=query.sort,
            only_active=not self.is_manager,  # الكاشير لا يرى المعطّل
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_products(filters)
        return ProductListOut(
            items=[self._to_out(p) for p in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def summary(self) -> ProductsSummaryOut:
        s = self.repo.summary()
        return ProductsSummaryOut(
            total=s.total,
            low=s.low,
            out=s.out,
            stock_value=s.stock_value if self.is_manager else None,
        )

    def get_product(self, product_id: str) -> ProductOut:
        return self._to_out(self._get_visible(product_id))

    def find_by_barcode(self, barcode: str) -> BarcodeLookupOut:
        found = self.repo.find_by_barcode(normalize_digits(barcode).strip())
        if found is None or (not self.is_manager and not found[0].is_active):
            raise self._err(NotFoundError, ProductError.NOT_FOUND)
        product, unit = found
        return BarcodeLookupOut(
            product=self._to_out(product), matched_unit_id=unit.id if unit else None
        )

    def list_categories(self) -> list[CategoryOut]:
        return [CategoryOut.model_validate(c) for c in self.repo.list_categories()]

    def list_ledger(self, product_id: str, query: LedgerQuery) -> StockLedgerOut:
        self._get_or_404(product_id)
        rows, total = self.repo.list_movements(product_id, query.page, query.page_size)
        return StockLedgerOut(
            items=[StockMovementOut.model_validate(m) for m in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    # ================= كتابة =================
    def create_product(self, data: ProductCreate) -> ProductOut:
        self._check_category(data.category_id)
        self._check_barcodes(data)

        product = Product(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            stock_qty=0,
        )
        self._apply_fields(product, data)
        self._sync_units(product, data.extra_units)
        self._refresh_search_text(product)
        self.repo.add(product)
        self.repo.flush()

        if data.opening_stock > 0:
            self._record_movement(
                product, MovementType.OPENING, data.opening_stock, note="رصيد افتتاحي"
            )

        self._audit(product, "create", self._snapshot(product))
        self._enqueue(product, base_version=None)
        self._commit()
        return self._to_out(product)

    def update_product(self, product_id: str, data: ProductUpdate) -> ProductOut:
        product = self._get_or_404(product_id)
        self._check_version(product, data.base_version)
        self._check_category(data.category_id)
        self._check_barcodes(data, exclude_product_id=product.id)

        before = self._snapshot(product)
        self._apply_fields(product, data)
        self._sync_units(product, data.extra_units)
        self._refresh_search_text(product)
        product.mark_modified()
        self.repo.flush()

        self._audit(product, "update", diff_snapshots(before, self._snapshot(product)))
        self._enqueue(product, base_version=data.base_version)
        self._commit()
        return self._to_out(product)

    def duplicate_product(self, product_id: str) -> ProductOut:
        src = self._get_or_404(product_id)
        copy = Product(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            name=(src.name[: MAX_NAME_LEN - len(COPY_SUFFIX)] + COPY_SUFFIX),
            barcode=None,  # الباركود فريد، فلا يُنسخ
            category_id=src.category_id,
            unit=src.unit,
            allow_decimal=src.allow_decimal,
            cost_price=src.cost_price,
            sale_price=src.sale_price,
            min_stock=src.min_stock,
            is_active=src.is_active,
            stock_qty=0,
        )
        for u in src.units:
            copy.all_units.append(
                ProductUnit(
                    id=uuid7(),
                    product_id=copy.id,
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    name=u.name,
                    factor=u.factor,
                    barcode=None,
                    sale_price=u.sale_price,
                )
            )
        self._refresh_search_text(copy)
        self.repo.add(copy)
        self.repo.flush()
        self._audit(copy, "duplicate", {"source_id": src.id})
        self._enqueue(copy, base_version=None)
        self._commit()
        return self._to_out(copy)

    def toggle_active(self, product_id: str, base_version: int) -> ProductOut:
        product = self._get_or_404(product_id)
        self._set_active(product, not product.is_active, base_version)
        return self._to_out(product)

    def delete_product(self, product_id: str, base_version: int) -> None:
        product = self._get_or_404(product_id)
        self._check_version(product, base_version)
        if product.stock_qty != 0:
            raise self._err(ConflictError, ProductError.HAS_STOCK, stock_qty=product.stock_qty)

        for unit in product.units:
            unit.mark_deleted()
        self._soft_delete(
            product, base_version, {"name": product.name, "stock_qty": product.stock_qty}
        )

    def adjust_stock(self, product_id: str, data: StockAdjustIn) -> StockMovementOut:
        product = self._get_or_404(product_id)
        if not product.allow_decimal and data.qty % QTY_SCALE:
            raise self._err(BadRequestError, ProductError.FRACTION_NOT_ALLOWED)

        delta, movement_type = compute_adjustment(data.reason, data.qty, product.stock_qty)
        if delta == 0:
            raise self._err(BadRequestError, ProductError.NO_STOCK_CHANGE)
        if product.stock_qty + delta < 0:
            raise self._err(
                BadRequestError, ProductError.INSUFFICIENT_STOCK, available=product.stock_qty
            )

        movement = self._record_movement(product, movement_type, delta, note=data.note)
        self._audit(
            product,
            "stock_adjust",
            {
                "reason": data.reason.value,
                "qty_delta": delta,
                "balance_after": movement.balance_after,
            },
        )
        self._commit()
        return StockMovementOut.model_validate(movement)

    # ================= عمليات جماعية =================
    def bulk_delete(self, data: BulkIn) -> BulkResultOut:
        return self._run_bulk(
            data, lambda item: self.delete_product(item.id, item.base_version)
        )

    def bulk_deactivate(self, data: BulkIn) -> BulkResultOut:
        return self._bulk_deactivate(data, self._get_or_404)

    # ================= واجهة للموديولات الأخرى (بدون commit) =================
    def get_for_update(self, product_id: str) -> Product:
        """الصنف الحي (حتى لو معطّلاً) لعمليات البيع والشراء. 404 لو محذوف."""
        return self._get_or_404(product_id)

    def move_stock(
        self,
        product: Product,
        movement_type: MovementType,
        delta: int,
        *,
        unit_cost: int | None = None,
        note: str | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> StockMovement:
        """حركة مخزون مرتبطة بمستند (فاتورة بيع/شراء/مرتجع). الموديول المستدعي يملك المعاملة."""
        return self._record_movement(
            product,
            movement_type,
            delta,
            note=note,
            unit_cost=unit_cost,
            ref_type=ref_type,
            ref_id=ref_id,
        )

    def apply_purchase_prices(
        self,
        product: Product,
        *,
        received_qty: int,
        unit_cost: int,
        new_sale_price: int | None,
        ref_id: str,
    ) -> None:
        """متوسط تكلفة مرجّح بعد الشراء (+ سعر بيع جديد اختياري). يُستدعى قبل move_stock."""
        before = {"cost_price": product.cost_price, "sale_price": product.sale_price}
        old_qty = max(product.stock_qty, 0)
        total_qty = old_qty + received_qty
        if old_qty > 0 and total_qty > 0:
            cost = (old_qty * product.cost_price + received_qty * unit_cost + total_qty // 2) // total_qty
        else:
            cost = unit_cost
        product.cost_price = cost
        if new_sale_price:
            product.sale_price = new_sale_price
        after = {"cost_price": product.cost_price, "sale_price": product.sale_price}
        if after == before:
            return
        base_version = product.version
        product.mark_modified()
        self._audit(product, "price_from_purchase", {**diff_snapshots(before, after), "purchase_id": ref_id})
        self._enqueue(product, base_version=base_version)

    # ================= داخلي =================
    def _get_or_404(self, product_id: str) -> Product:
        product = self.repo.get(product_id)
        if product is None:
            raise self._err(NotFoundError, ProductError.NOT_FOUND)
        return product

    def _get_visible(self, product_id: str) -> Product:
        product = self._get_or_404(product_id)
        if not self.is_manager and not product.is_active:
            raise self._err(NotFoundError, ProductError.NOT_FOUND)
        return product

    def _check_category(self, category_id: str | None) -> None:
        if category_id and self.repo.get_category(category_id) is None:
            raise self._err(BadRequestError, ProductError.CATEGORY_NOT_FOUND)

    def _check_barcodes(self, data: ProductBase, exclude_product_id: str | None = None) -> None:
        codes = [data.barcode, *(u.barcode for u in data.extra_units)]
        for code in filter(None, codes):
            if self.repo.barcode_taken(code, exclude_product_id=exclude_product_id):
                raise self._err(ConflictError, ProductError.BARCODE_TAKEN, barcode=code)

    @staticmethod
    def _apply_fields(product: Product, data: ProductBase) -> None:
        product.name = data.name
        product.barcode = data.barcode
        product.category_id = data.category_id
        product.unit = data.unit
        product.allow_decimal = data.allow_decimal
        product.cost_price = data.cost_price
        product.sale_price = data.sale_price
        product.min_stock = data.min_stock
        product.is_active = data.is_active

    def _sync_units(self, product: Product, incoming: list[UnitIn]) -> None:
        existing = {u.id: u for u in product.units}
        kept: set[str] = set()
        for item in incoming:
            unit = existing.get(item.id) if item.id else None
            if unit is None:
                unit = ProductUnit(
                    id=uuid7(),
                    product_id=product.id,
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    name=item.name,
                    factor=item.factor,
                    barcode=item.barcode,
                    sale_price=item.sale_price,
                )
                product.all_units.append(unit)
            else:
                new = (item.name, item.factor, item.barcode, item.sale_price)
                if new != (unit.name, unit.factor, unit.barcode, unit.sale_price):
                    unit.name, unit.factor, unit.barcode, unit.sale_price = new
                    unit.mark_modified()
            kept.add(unit.id)
        for unit_id, unit in existing.items():
            if unit_id not in kept:
                unit.mark_deleted()

    @staticmethod
    def _refresh_search_text(product: Product) -> None:
        product.search_text = build_search_text(
            product.name, [product.barcode, *(u.barcode for u in product.units)]
        )

    def _record_movement(
        self,
        product: Product,
        movement_type: MovementType,
        delta: int,
        *,
        note: str | None = None,
        unit_cost: int | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> StockMovement:
        balance = product.stock_qty + delta
        movement = StockMovement(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            product_id=product.id,
            movement_type=movement_type.value,
            qty_delta=delta,
            balance_after=balance,
            unit_cost=product.cost_price if unit_cost is None else unit_cost,
            note=note,
            ref_type=ref_type,
            ref_id=ref_id,
        )
        product.stock_qty = balance  # الرصيد المخزّن، داخل نفس المعاملة
        self.repo.add_movement(movement)
        self._enqueue_event(
            ENTITY_STOCK_MOVEMENT,
            movement.id,
            {
                "id": movement.id,
                "product_id": product.id,
                "movement_type": movement.movement_type,
                "qty_delta": delta,
                "balance_after": balance,
                "unit_cost": movement.unit_cost,
                "note": note,
                "ref_type": ref_type,
                "ref_id": ref_id,
            },
        )
        return movement

    def _to_out(self, p: Product) -> ProductOut:
        """الكاشير لا يرى سعر الشراء ولا الهامش."""
        return ProductOut(
            id=p.id,
            name=p.name,
            barcode=p.barcode,
            category_id=p.category_id,
            category_name=p.category.name if p.category else None,
            unit=p.unit,
            allow_decimal=p.allow_decimal,
            cost_price=p.cost_price if self.is_manager else None,
            sale_price=p.sale_price,
            margin_percent=calc_margin_percent(p.cost_price, p.sale_price)
            if self.is_manager
            else None,
            min_stock=p.min_stock,
            stock_qty=p.stock_qty,
            stock_level=calc_stock_level(p.stock_qty, p.min_stock),
            is_active=p.is_active,
            extra_units=[UnitOut.model_validate(u) for u in p.units],
            version=p.version,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )