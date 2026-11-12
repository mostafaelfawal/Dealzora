"""طلبات الشراء الذكية: اقتراح النواقص من معدل البيع الفعلي + طلبات للموردين.

الاقتراح (لكل صنف نشط):
- معدل البيع اليومي = صافي المبيعات (بيع − مرتجع) في الفترة ÷ عدد أيامها
  (صنف أحدث من الفترة يُقسم على عمره، وأقل قسمة أسبوع حتى لا يبالغ أول يومين).
- نقطة الطلب = الحد الأدنى + المعدل × أيام التوريد. وصل لها الرصيد ← يظهر في النواقص.
- الكمية المقترحة = (الحد الأدنى + المعدل × (التوريد + التغطية)) − الرصيد − الموجود في طلبات مفتوحة،
  تُقرّب لأعلى لعدد صحيح (للأصناف غير الكسرية) ولكرتونة كاملة لو الصنف له وحدة أكبر.
- المورد المقترح = آخر مورد اشترينا منه الصنف، والسعر = آخر سعر شراء فعلي (بعد الخصم).

الطلب لا يحرك مخزوناً ولا حسابات. عند وصول البضاعة يتحول لفاتورة شراء عادية
(PurchaseCreate.order_id) فيُغلق الطلب في نفس معاملة الفاتورة.
"""

import math
from collections import defaultdict
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.base import utcnow, uuid7
from app.core.constants import QTY_SCALE
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.core.lookups import user_names
from app.core.periods import day_bounds_utc, local_today
from app.core.repository import fetch_page, live
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.timeutils import aware
from app.modules.products.model import Product, StockMovement
from app.modules.products.types import MovementType
from app.modules.sales.helper import qty_amount
from app.modules.suppliers.model import Supplier

from .constants import (
    ENTITY_PURCHASE_ORDER,
    ERROR_MESSAGES,
    MIN_HISTORY_DAYS,
    NO_SALES_TARGET_FACTOR,
    OPEN_STATUSES,
    URGENCY_RANK,
    OrderError,
    OrderStatus,
    OrderStatusFilter,
    Urgency,
)
from .model import PurchaseOrder, PurchaseOrderLine
from .schema import (
    OrderCreate,
    OrderLineOut,
    OrderListOut,
    OrderListQuery,
    OrderOut,
    OrdersSummaryOut,
    OrderUpdate,
    SuggestionOut,
    SuggestionsOut,
    SuggestionsQuery,
    SuggestionsTotals,
)

_OPEN = [s.value for s in OPEN_STATUSES]


def _ceil_to(value: int, step: int) -> int:
    return -(-value // step) * step if step > 0 else value


class PurchaseOrderService(EntityService):
    entity = ENTITY_PURCHASE_ORDER
    messages = ERROR_MESSAGES
    version_conflict_error = OrderError.VERSION_CONFLICT

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)

    # ================= اقتراح النواقص =================
    def suggestions(self, q: SuggestionsQuery) -> SuggestionsOut:
        products = list(
            self.session.scalars(
                select(Product).where(live(Product), Product.is_active.is_(True))
            ).all()
        )
        sold = self._net_sold(q.sales_days)
        on_order = self._on_order()
        last = self._last_purchases()
        now = utcnow()

        items: list[SuggestionOut] = []
        for p in products:
            age_days = max((now - aware(p.created_at)).days, 0)
            days = min(q.sales_days, max(age_days, MIN_HISTORY_DAYS))
            sold_qty = max(sold.get(p.id, 0), 0)
            avg = sold_qty / days  # × 1000 لليوم

            if avg <= 0 and p.min_stock <= 0:
                continue  # لا يُباع ولا حد أدنى: لا شيء يدل على حاجته
            reorder_point = p.min_stock + avg * q.lead_days
            if p.stock_qty > reorder_point:
                continue

            target = (
                p.min_stock + avg * (q.lead_days + q.cover_days)
                if avg > 0
                else p.min_stock * NO_SALES_TARGET_FACTOR
            )
            incoming = on_order.get(p.id, 0)
            need = max(math.ceil(target - p.stock_qty - incoming), 0)
            if need and not p.allow_decimal:
                need = _ceil_to(need, QTY_SCALE)
            pack = self._pack(p, need) if q.round_packs and need else None
            if pack:
                need = _ceil_to(need, pack[1])

            days_left = (max(p.stock_qty, 0) / avg) if avg > 0 else None
            if p.stock_qty <= 0:
                urgency = Urgency.OUT
            elif days_left is not None and days_left <= q.lead_days:
                urgency = Urgency.CRITICAL
            elif p.stock_qty <= p.min_stock:
                urgency = Urgency.LOW
            else:
                urgency = Urgency.SOON

            info = last.get(p.id)
            cost = info["base_cost"] if info and info["base_cost"] else p.cost_price
            items.append(
                SuggestionOut(
                    product_id=p.id,
                    name=p.name,
                    barcode=p.barcode,
                    category_name=p.category.name if p.category else None,
                    unit=p.unit,
                    allow_decimal=p.allow_decimal,
                    stock=p.stock_qty,
                    min_stock=p.min_stock,
                    on_order=incoming,
                    sold_qty=sold_qty,
                    avg_daily=round(avg),
                    days_left=round(days_left, 1) if days_left is not None else None,
                    urgency=urgency,
                    suggested_qty=need,
                    pack_name=pack[0] if pack else None,
                    pack_factor=pack[1] if pack else None,
                    unit_cost=cost,
                    line_total=qty_amount(need, cost),
                    supplier_id=info["supplier_id"] if info else None,
                    supplier_name=info["supplier_name"] if info else None,
                    last_purchased_on=info["purchased_on"] if info else None,
                )
            )

        items.sort(
            key=lambda s: (
                URGENCY_RANK[s.urgency],
                s.days_left if s.days_left is not None else math.inf,
                s.name,
            )
        )
        counts = defaultdict(int)
        for s in items:
            counts[s.urgency] += 1
        return SuggestionsOut(
            sales_days=q.sales_days,
            cover_days=q.cover_days,
            lead_days=q.lead_days,
            items=items,
            totals=SuggestionsTotals(
                count=len(items),
                out=counts[Urgency.OUT],
                critical=counts[Urgency.CRITICAL],
                low=counts[Urgency.LOW],
                soon=counts[Urgency.SOON],
                estimated_total=sum(s.line_total for s in items),
                suppliers=len({s.supplier_id for s in items if s.suggested_qty}),
            ),
        )

    def _net_sold(self, days: int) -> dict[str, int]:
        """صافي المبيعات بالوحدة الأساسية (× 1000) من دفتر المخزون: البيع سالب والمرتجع موجب."""
        since = utcnow() - timedelta(days=days)
        rows = self.session.execute(
            select(StockMovement.product_id, func.sum(StockMovement.qty_delta))
            .where(
                StockMovement.movement_type.in_(
                    (MovementType.SALE.value, MovementType.SALE_RETURN.value)
                ),
                StockMovement.created_at >= since,
            )
            .group_by(StockMovement.product_id)
        ).all()
        return {pid: -int(total or 0) for pid, total in rows}

    def _on_order(self) -> dict[str, int]:
        rows = self.session.execute(
            select(PurchaseOrderLine.product_id, func.sum(PurchaseOrderLine.qty))
            .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderLine.order_id)
            .where(live(PurchaseOrder), PurchaseOrder.status.in_(_OPEN))
            .group_by(PurchaseOrderLine.product_id)
        ).all()
        return {pid: int(total or 0) for pid, total in rows}

    def _last_purchases(self) -> dict[str, dict]:
        """آخر شراء لكل صنف (المورد وتكلفة الوحدة الأساسية الفعلية). المورد المعطّل يُتجاهل."""
        from app.modules.purchases.model import Purchase, PurchaseLine  # متأخر: لا دوران

        rows = self.session.execute(
            select(
                PurchaseLine.product_id,
                PurchaseLine.base_cost,
                Purchase.supplier_id,
                Supplier.name,
                Purchase.purchased_on,
            )
            .join(Purchase, Purchase.id == PurchaseLine.purchase_id)
            .join(Supplier, Supplier.id == Purchase.supplier_id)
            .where(live(Purchase), live(Supplier), Supplier.is_active.is_(True))
            .order_by(Purchase.purchased_on.desc(), Purchase.number.desc())
        ).all()
        out: dict[str, dict] = {}
        for pid, cost, sid, sname, on in rows:
            out.setdefault(
                pid,
                {"base_cost": cost, "supplier_id": sid, "supplier_name": sname, "purchased_on": on},
            )
        return out

    @staticmethod
    def _pack(p: Product, need: int) -> tuple[str, int] | None:
        """أكبر وحدة (كرتونة/دستة) لا تتجاوز الكمية المطلوبة: نقرّب لها لأعلى."""
        fitting = [u for u in p.units if QTY_SCALE < u.factor <= need]
        if not fitting:
            return None
        best = max(fitting, key=lambda u: u.factor)
        return best.name, best.factor

    # ================= قراءة الطلبات =================
    def list_orders(self, q: OrderListQuery) -> OrderListOut:
        conds = [live(PurchaseOrder)]
        if q.status is OrderStatusFilter.OPEN:
            conds.append(PurchaseOrder.status.in_(_OPEN))
        elif q.status is not OrderStatusFilter.ALL:
            conds.append(PurchaseOrder.status == q.status.value)
        if q.supplier_id:
            conds.append(PurchaseOrder.supplier_id == q.supplier_id)
        rows, total = fetch_page(
            self.session,
            PurchaseOrder,
            conds,
            [PurchaseOrder.number.desc()],
            q.page,
            q.page_size,
        )
        return OrderListOut(items=self._out(rows), total=total, page=q.page, page_size=q.page_size)

    def get_order(self, order_id: str) -> OrderOut:
        return self._out([self._get_or_404(order_id)])[0]

    def summary(self) -> OrdersSummaryOut:
        rows = self.session.execute(
            select(PurchaseOrder.status, func.count(), func.coalesce(func.sum(PurchaseOrder.total), 0))
            .where(live(PurchaseOrder), PurchaseOrder.status.in_(_OPEN))
            .group_by(PurchaseOrder.status)
        ).all()
        by = {s: (c, t) for s, c, t in rows}
        today = local_today()
        month_start, _ = day_bounds_utc(today.replace(day=1), today)
        received = self.session.scalar(
            select(func.count()).where(
                live(PurchaseOrder),
                PurchaseOrder.status == OrderStatus.RECEIVED.value,
                PurchaseOrder.closed_at >= month_start,
            )
        )
        return OrdersSummaryOut(
            draft=by.get(OrderStatus.DRAFT.value, (0, 0))[0],
            sent=by.get(OrderStatus.SENT.value, (0, 0))[0],
            open_total=sum(t for _, t in by.values()),
            received_month=received or 0,
        )

    # ================= كتابة =================
    def create_order(self, data: OrderCreate) -> OrderOut:
        supplier = self._supplier(data.supplier_id)
        number = (self.session.scalar(select(func.max(PurchaseOrder.number))) or 0) + 1
        order = PurchaseOrder(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            number=number,
            supplier_id=supplier.id,
            supplier_name=supplier.name,
            status=OrderStatus.DRAFT.value,
            note=data.note,
        )
        self.session.add(order)
        self._set_lines(order, data)
        self.session.flush()
        self._audit(
            order,
            "create",
            {"number": number, "supplier_id": supplier.id, "total": order.total, "lines": len(order.lines)},
        )
        self._enqueue_event(ENTITY_PURCHASE_ORDER, order.id, self._payload(order))
        self._commit()
        return self._out([order])[0]

    def update_order(self, order_id: str, data: OrderUpdate) -> OrderOut:
        order = self._editable(order_id, data.base_version)
        supplier = self._supplier(data.supplier_id)
        before = order.total
        order.supplier_id = supplier.id
        order.supplier_name = supplier.name
        order.note = data.note
        order.lines.clear()
        self.session.flush()
        self._set_lines(order, data)
        order.mark_modified()
        self._audit(order, "update", {"total": {"from": before, "to": order.total}})
        self._enqueue_event(ENTITY_PURCHASE_ORDER, order.id, self._payload(order))
        self._commit()
        return self._out([order])[0]

    def mark_sent(self, order_id: str, base_version: int) -> OrderOut:
        order = self._editable(order_id, base_version)
        if order.status != OrderStatus.SENT.value:
            order.status = OrderStatus.SENT.value
            order.sent_at = utcnow()
            order.mark_modified()
            self._audit(order, "send", {"number": order.number})
            self._enqueue_event(ENTITY_PURCHASE_ORDER, order.id, self._payload(order))
            self._commit()
        return self._out([order])[0]

    def cancel(self, order_id: str, base_version: int) -> OrderOut:
        order = self._editable(order_id, base_version)
        order.status = OrderStatus.CANCELLED.value
        order.closed_at = utcnow()
        order.mark_modified()
        self._audit(order, "cancel", {"number": order.number})
        self._enqueue_event(ENTITY_PURCHASE_ORDER, order.id, self._payload(order))
        self._commit()
        return self._out([order])[0]

    def mark_received(self, order_id: str, purchase_id: str, purchase_number: int) -> None:
        """يُستدعى من فاتورة الشراء داخل معاملتها (بدون commit هنا)."""
        order = self._get_or_404(order_id)
        if order.status not in _OPEN:
            raise self._err(ConflictError, OrderError.NOT_EDITABLE)
        order.status = OrderStatus.RECEIVED.value
        order.closed_at = utcnow()
        order.purchase_id = purchase_id
        order.mark_modified()
        self._audit(
            order, "receive", {"number": order.number, "purchase_id": purchase_id, "purchase_number": purchase_number}
        )
        self._enqueue_event(ENTITY_PURCHASE_ORDER, order.id, self._payload(order))

    # ================= مساعدات =================
    def _get_or_404(self, order_id: str) -> PurchaseOrder:
        order = self.session.scalars(
            select(PurchaseOrder).where(PurchaseOrder.id == order_id, live(PurchaseOrder))
        ).first()
        if order is None:
            raise self._err(NotFoundError, OrderError.NOT_FOUND)
        return order

    def _editable(self, order_id: str, base_version: int) -> PurchaseOrder:
        order = self._get_or_404(order_id)
        self._check_version(order, base_version)
        if order.status not in _OPEN:
            raise self._err(ConflictError, OrderError.NOT_EDITABLE)
        return order

    def _supplier(self, supplier_id: str) -> Supplier:
        supplier = self.session.scalars(
            select(Supplier).where(
                Supplier.id == supplier_id, live(Supplier), Supplier.is_active.is_(True)
            )
        ).first()
        if supplier is None:
            raise self._err(BadRequestError, OrderError.SUPPLIER_INACTIVE)
        return supplier

    def _set_lines(self, order: PurchaseOrder, data: OrderCreate) -> None:
        ids = [line.product_id for line in data.lines]
        if len(set(ids)) != len(ids):
            raise self._err(BadRequestError, OrderError.DUPLICATE_PRODUCT)
        products = {
            p.id: p
            for p in self.session.scalars(
                select(Product).where(Product.id.in_(ids), live(Product))
            ).all()
        }
        total = 0
        for item in data.lines:
            product = products.get(item.product_id)
            if product is None:
                raise self._err(NotFoundError, OrderError.PRODUCT_NOT_FOUND)
            if not product.allow_decimal and item.qty % QTY_SCALE:
                raise self._err(BadRequestError, OrderError.FRACTION_NOT_ALLOWED, product=product.name)
            line_total = qty_amount(item.qty, item.unit_cost)
            total += line_total
            order.lines.append(
                PurchaseOrderLine(
                    id=uuid7(),
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    product_id=product.id,
                    name=product.name,
                    unit_name=product.unit,
                    qty=item.qty,
                    unit_cost=item.unit_cost,
                    line_total=line_total,
                    stock_at_order=product.stock_qty,
                )
            )
        order.total = total

    @staticmethod
    def _payload(o: PurchaseOrder) -> dict:
        return {
            "id": o.id,
            "number": o.number,
            "supplier_id": o.supplier_id,
            "status": o.status,
            "total": o.total,
            "purchase_id": o.purchase_id,
            "lines": [
                {"id": l.id, "product_id": l.product_id, "qty": l.qty, "unit_cost": l.unit_cost}
                for l in o.lines
            ],
        }

    def _out(self, rows: list[PurchaseOrder]) -> list[OrderOut]:
        from app.modules.purchases.model import Purchase  # متأخر: لا دوران

        names = user_names(self.session, [o.created_by for o in rows])
        supplier_ids = {o.supplier_id for o in rows}
        phones = dict(
            self.session.execute(
                select(Supplier.id, Supplier.phone).where(Supplier.id.in_(supplier_ids))
            ).all()
        ) if supplier_ids else {}
        product_ids = {l.product_id for o in rows for l in o.lines}
        stocks = dict(
            self.session.execute(
                select(Product.id, Product.stock_qty).where(Product.id.in_(product_ids), live(Product))
            ).all()
        ) if product_ids else {}
        purchase_ids = {o.purchase_id for o in rows if o.purchase_id}
        numbers = dict(
            self.session.execute(
                select(Purchase.id, Purchase.number).where(Purchase.id.in_(purchase_ids))
            ).all()
        ) if purchase_ids else {}
        return [
            OrderOut(
                id=o.id,
                number=o.number,
                version=o.version,
                supplier_id=o.supplier_id,
                supplier_name=o.supplier_name,
                supplier_phone=phones.get(o.supplier_id),
                status=OrderStatus(o.status),
                total=o.total,
                note=o.note,
                created_at=o.created_at,
                created_by_name=names.get(o.created_by or ""),
                sent_at=o.sent_at,
                closed_at=o.closed_at,
                purchase_id=o.purchase_id,
                purchase_number=numbers.get(o.purchase_id) if o.purchase_id else None,
                lines=[
                    OrderLineOut(
                        id=l.id,
                        product_id=l.product_id,
                        name=l.name,
                        unit_name=l.unit_name,
                        qty=l.qty,
                        unit_cost=l.unit_cost,
                        line_total=l.line_total,
                        stock_at_order=l.stock_at_order,
                        current_stock=stocks.get(l.product_id),
                    )
                    for l in o.lines
                ],
            )
            for o in rows
        ]
