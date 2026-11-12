"""قواعد الشراء ومرتجعه (للمدير فقط). كل أمر = معاملة واحدة:
الفاتورة + المخزون + متوسط التكلفة + كشف حساب المورد + الخزنة + Audit + Outbox ثم commit واحد.

كشف حساب المورد يسجّل الفاتورة كاملة (+الإجمالي) ثم المدفوع كاش (−المدفوع)،
فيظهر للتاجر بوضوح ماذا اشترى وماذا دفع، والرصيد = المتبقي له.
"""

from collections import defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.constants import QTY_SCALE
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.core.lookups import user_names
from app.core.periods import local_today
from app.core.security import Actor
from app.core.service_base import EntityService
from app.modules.products.model import Product
from app.modules.products.service import ProductService
from app.modules.products.types import MovementType
from app.modules.sales.helper import allocate, base_qty, proportional, qty_amount, round_div
from app.modules.suppliers.service import SupplierService
from app.modules.suppliers.types import TransactionType
from app.modules.treasury.service import TreasuryService
from app.modules.treasury.types import CashDirection, CashKind

from .constants import (
    ENTITY_PURCHASE,
    ENTITY_PURCHASE_RETURN,
    ERROR_MESSAGES,
    REF_PURCHASE,
    REF_PURCHASE_RETURN,
    PurchaseError,
)
from .model import Purchase, PurchaseLine, PurchaseReturn, PurchaseReturnLine
from .repository import PurchaseRepository
from .schema import (
    PurchaseCreate,
    PurchaseLineOut,
    PurchaseListOut,
    PurchaseListQuery,
    PurchaseOut,
    PurchaseReturnCreate,
    PurchaseReturnLineOut,
    PurchaseReturnOut,
    PurchasesSummaryOut,
)
from .types import PurchaseFilters, RefundMethod


class PurchaseService(EntityService):
    entity = ENTITY_PURCHASE
    messages = ERROR_MESSAGES
    version_conflict_error = PurchaseError.NOT_FOUND

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = PurchaseRepository(session)
        self.products = ProductService(session, actor)
        self.suppliers = SupplierService(session, actor)
        self.treasury = TreasuryService(session, actor)

    # ================= قراءة =================
    def list_purchases(self, query: PurchaseListQuery) -> PurchaseListOut:
        term = query.q.strip().lstrip("#")
        filters = PurchaseFilters(
            query="" if term.isdigit() else query.q,
            number=int(term) if term.isdigit() else None,
            supplier_id=query.supplier_id,
            status=query.status,
            date_from=query.date_from,
            date_to=query.date_to,
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_purchases(filters)
        return PurchaseListOut(
            items=self._out(rows), total=total, page=query.page, page_size=query.page_size
        )

    def get_purchase(self, purchase_id: str) -> PurchaseOut:
        return self._out([self._get_or_404(purchase_id)])[0]

    def summary(self) -> PurchasesSummaryOut:
        today = local_today()
        count, total, paid, returns = self.repo.period(today.replace(day=1), today)
        return PurchasesSummaryOut(
            month_count=count, month_total=total, month_paid=paid, returns_month=returns
        )

    # ================= كتابة =================
    def create_purchase(self, data: PurchaseCreate) -> PurchaseOut:
        if data.purchased_on > local_today() + timedelta(days=1):
            raise self._err(BadRequestError, PurchaseError.FUTURE_DATE)
        supplier = self.suppliers.get_for_update(data.supplier_id)
        number = self.repo.next_number()

        priced: list[dict] = []
        for item in data.lines:
            product = self._product(item.product_id)
            factor, unit_name = self._unit_info(product, item.unit_id)
            base = base_qty(item.qty, factor)
            if not product.allow_decimal and base % QTY_SCALE:
                raise self._err(BadRequestError, PurchaseError.FRACTION_NOT_ALLOWED, product=product.name)
            priced.append(
                {
                    "product": product,
                    "unit_id": item.unit_id,
                    "unit_name": unit_name,
                    "factor": factor,
                    "qty": item.qty,
                    "base": base,
                    "unit_cost": item.unit_cost,
                    "total": qty_amount(item.qty, item.unit_cost),
                    "new_sale_price": item.new_sale_price,
                }
            )

        subtotal = sum(p["total"] for p in priced)
        if data.discount > subtotal:
            raise self._err(BadRequestError, PurchaseError.DISCOUNT_TOO_HIGH)
        total = subtotal - data.discount
        if data.paid_amount > total:
            raise self._err(BadRequestError, PurchaseError.PAID_EXCEEDS_TOTAL, total=total)

        purchase = Purchase(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            number=number,
            supplier_id=supplier.id,
            supplier_name=supplier.name,
            supplier_invoice=data.supplier_invoice,
            purchased_on=data.purchased_on,
            subtotal=subtotal,
            discount=data.discount,
            total=total,
            paid_amount=data.paid_amount,
            credit_amount=total - data.paid_amount,
            note=data.note,
        )
        self.repo.add(purchase)

        nets = allocate(data.discount, [p["total"] for p in priced])
        for p, net in zip(priced, nets, strict=True):
            product: Product = p["product"]
            base_cost = round_div(net * QTY_SCALE, p["base"]) if p["base"] else 0
            purchase.lines.append(
                PurchaseLine(
                    id=uuid7(),
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    product_id=product.id,
                    unit_id=p["unit_id"],
                    name=product.name,
                    unit_name=p["unit_name"],
                    factor=p["factor"],
                    qty=p["qty"],
                    unit_cost=p["unit_cost"],
                    line_total=p["total"],
                    net_total=net,
                    base_cost=base_cost,
                )
            )
            # متوسط التكلفة يُحسب قبل إضافة الكمية للرصيد.
            self.products.apply_purchase_prices(
                product,
                received_qty=p["base"],
                unit_cost=base_cost,
                new_sale_price=p["new_sale_price"],
                ref_id=purchase.id,
            )
            self.products.move_stock(
                product,
                MovementType.PURCHASE,
                p["base"],
                unit_cost=base_cost,
                note=f"فاتورة شراء #{number}",
                ref_type=REF_PURCHASE,
                ref_id=purchase.id,
            )
        self.repo.flush()

        label = f"فاتورة شراء #{number}" + (
            f" (مورد: {data.supplier_invoice})" if data.supplier_invoice else ""
        )
        self.suppliers.record_transaction(
            supplier, TransactionType.PURCHASE, total, note=label, ref_type=REF_PURCHASE, ref_id=purchase.id
        )
        if data.paid_amount:
            self.suppliers.record_transaction(
                supplier,
                TransactionType.PAYMENT,
                -data.paid_amount,
                note=f"مدفوع مع {label}",
                ref_type=REF_PURCHASE,
                ref_id=purchase.id,
            )
            self.treasury.post_entry(
                direction=CashDirection.OUT,
                kind=CashKind.PURCHASE,
                amount=data.paid_amount,
                occurred_at=data.purchased_on,
                note=f"{label} — {supplier.name}",
                source_entity=ENTITY_PURCHASE,
                source_id=purchase.id,
            )

        if data.order_id:
            from app.modules.purchase_orders.service import PurchaseOrderService  # متأخر: لا دوران

            PurchaseOrderService(self.session, self.actor).mark_received(
                data.order_id, purchase.id, number
            )

        self._audit(
            purchase,
            "create",
            {"number": number, "supplier_id": supplier.id, "total": total, "paid": data.paid_amount},
        )
        self._enqueue_event(ENTITY_PURCHASE, purchase.id, self._payload(purchase))
        self._commit()
        return self._out([purchase])[0]

    def create_return(self, purchase_id: str, data: PurchaseReturnCreate) -> PurchaseReturnOut:
        purchase = self._get_or_404(purchase_id)
        supplier = self.suppliers.get_for_update(purchase.supplier_id)
        by_id = {line.id: line for line in purchase.lines}
        requested: dict[str, int] = defaultdict(int)
        for item in data.lines:
            requested[item.purchase_line_id] += item.qty

        number = self.repo.next_return_number()
        ret = PurchaseReturn(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            number=number,
            purchase_id=purchase.id,
            supplier_id=supplier.id,
            returned_on=local_today(),
            refund_method=data.refund_method.value,
            total=0,
            note=data.note,
        )
        total = 0
        moves: list[tuple[Product, int, PurchaseLine]] = []
        for line_id, qty in requested.items():
            line = by_id.get(line_id)
            if line is None:
                raise self._err(NotFoundError, PurchaseError.RETURN_LINE_NOT_FOUND)
            available = line.qty - line.returned_qty
            if qty > available:
                raise self._err(
                    BadRequestError, PurchaseError.RETURN_QTY_EXCEEDS, product=line.name, available=available
                )
            product = self.products.get_for_update(line.product_id)
            base = base_qty(qty, line.factor)
            if not product.allow_decimal and base % QTY_SCALE:
                raise self._err(BadRequestError, PurchaseError.FRACTION_NOT_ALLOWED, product=line.name)
            if product.stock_qty - base < 0:
                raise self._err(
                    ConflictError, PurchaseError.INSUFFICIENT_STOCK, product=line.name, available=product.stock_qty
                )
            amount = (
                line.net_total - line.returned_amount
                if qty == available
                else proportional(qty, line.qty, line.net_total)
            )
            line.returned_qty += qty
            line.returned_amount += amount
            total += amount
            ret.lines.append(
                PurchaseReturnLine(
                    id=uuid7(),
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    purchase_line_id=line.id,
                    product_id=line.product_id,
                    name=line.name,
                    qty=qty,
                    amount=amount,
                )
            )
            moves.append((product, base, line))

        ret.total = total
        purchase.returned_total += total
        self.repo.add_any(ret)
        self.repo.flush()

        label = f"مرتجع شراء #{number} من فاتورة #{purchase.number}"
        for product, base, line in moves:
            self.products.move_stock(
                product,
                MovementType.PURCHASE_RETURN,
                -base,
                unit_cost=line.base_cost,
                note=label,
                ref_type=REF_PURCHASE_RETURN,
                ref_id=ret.id,
            )
        if data.refund_method is RefundMethod.BALANCE:
            self.suppliers.record_transaction(
                supplier,
                TransactionType.PURCHASE_RETURN,
                -total,
                note=label,
                ref_type=REF_PURCHASE_RETURN,
                ref_id=ret.id,
            )
        else:
            self.treasury.post_entry(
                direction=CashDirection.IN,
                kind=CashKind.PURCHASE_RETURN,
                amount=total,
                occurred_at=ret.returned_on,
                note=f"{label} — {supplier.name}",
                source_entity=ENTITY_PURCHASE_RETURN,
                source_id=ret.id,
            )

        self._audit(
            purchase,
            "return",
            {"return_number": number, "total": total, "refund_method": data.refund_method.value},
        )
        self._enqueue_event(
            ENTITY_PURCHASE_RETURN,
            ret.id,
            {
                "id": ret.id,
                "number": number,
                "purchase_id": purchase.id,
                "total": total,
                "refund_method": ret.refund_method,
                "lines": [
                    {"purchase_line_id": l.purchase_line_id, "qty": l.qty, "amount": l.amount}
                    for l in ret.lines
                ],
            },
        )
        self._commit()
        return PurchaseReturnOut(
            id=ret.id,
            number=ret.number,
            purchase_id=purchase.id,
            supplier_id=supplier.id,
            returned_on=ret.returned_on,
            refund_method=data.refund_method,
            total=total,
            note=ret.note,
            lines=[
                PurchaseReturnLineOut(
                    id=l.id, purchase_line_id=l.purchase_line_id, name=l.name, qty=l.qty, amount=l.amount
                )
                for l in ret.lines
            ],
        )

    # ================= داخلي =================
    def _get_or_404(self, purchase_id: str) -> Purchase:
        purchase = self.repo.get(purchase_id)
        if purchase is None:
            raise self._err(NotFoundError, PurchaseError.NOT_FOUND)
        return purchase

    def _product(self, product_id: str) -> Product:
        try:
            return self.products.get_for_update(product_id)
        except NotFoundError as exc:
            raise self._err(NotFoundError, PurchaseError.PRODUCT_NOT_FOUND) from exc

    def _unit_info(self, product: Product, unit_id: str | None) -> tuple[int, str]:
        if not unit_id:
            return QTY_SCALE, product.unit
        unit = next((u for u in product.units if u.id == unit_id), None)
        if unit is None:
            raise self._err(NotFoundError, PurchaseError.UNIT_NOT_FOUND)
        return unit.factor, unit.name

    @staticmethod
    def _payload(p: Purchase) -> dict:
        return {
            "id": p.id,
            "number": p.number,
            "supplier_id": p.supplier_id,
            "supplier_invoice": p.supplier_invoice,
            "purchased_on": p.purchased_on.isoformat(),
            "subtotal": p.subtotal,
            "discount": p.discount,
            "total": p.total,
            "paid_amount": p.paid_amount,
            "lines": [
                {
                    "id": l.id,
                    "product_id": l.product_id,
                    "unit_id": l.unit_id,
                    "qty": l.qty,
                    "unit_cost": l.unit_cost,
                    "net_total": l.net_total,
                }
                for l in p.lines
            ],
        }

    def _out(self, rows: list[Purchase]) -> list[PurchaseOut]:
        names = user_names(self.session, [p.created_by for p in rows])
        return [
            PurchaseOut(
                id=p.id,
                number=p.number,
                supplier_id=p.supplier_id,
                supplier_name=p.supplier_name,
                supplier_invoice=p.supplier_invoice,
                purchased_on=p.purchased_on,
                created_at=p.created_at,
                created_by_name=names.get(p.created_by or ""),
                subtotal=p.subtotal,
                discount=p.discount,
                total=p.total,
                paid_amount=p.paid_amount,
                credit_amount=p.credit_amount,
                returned_total=p.returned_total,
                note=p.note,
                lines=[
                    PurchaseLineOut(
                        id=l.id,
                        product_id=l.product_id,
                        name=l.name,
                        unit_name=l.unit_name,
                        qty=l.qty,
                        unit_cost=l.unit_cost,
                        line_total=l.line_total,
                        returned_qty=l.returned_qty,
                    )
                    for l in p.lines
                ],
            )
            for p in rows
        ]
