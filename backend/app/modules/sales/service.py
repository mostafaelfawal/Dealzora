"""قواعد البيع والمرتجع. كل أمر = معاملة واحدة:
الفاتورة + سطورها + حركات المخزون + كشف حساب العميل + الخزنة + Audit + Outbox ثم commit واحد.

الأمان:
- السيرفر لا يثق بأسعار الواجهة: يقارن كل سعر بالسعر الحالي ويرفض عند الاختلاف.
- الكاشير لا يرى التكلفة ولا الربح، وخصمه محدود بنسبة، ومرتجعه محدود بمهلة.
- client_ref فريد: إعادة إرسال نفس الفاتورة ترجع الفاتورة المحفوظة بدل تكرارها.
"""

from collections import defaultdict
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.plan import Feature, is_free, upgrade_error
from app.core.base import uuid7
from app.core.constants import QTY_SCALE, RETURN_WINDOW_DAYS
from app.core.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.lookups import user_names
from app.core.periods import local_today
from app.core.security import Actor
from app.core.service_base import EntityService
from app.modules.customers.model import Customer
from app.modules.customers.service import CustomerService
from app.modules.customers.types import LedgerType
from app.modules.products.model import Product
from app.modules.products.service import ProductService
from app.modules.products.types import MovementType
from app.modules.shifts.model import Shift
from app.modules.shifts.service import ShiftService
from app.modules.treasury.service import TreasuryService
from app.modules.treasury.types import CashDirection, CashKind

from .constants import (
    ALLOW_NEGATIVE_STOCK,
    CASHIER_MAX_DISCOUNT_PERCENT,
    ENTITY_SALE,
    ENTITY_SALE_RETURN,
    ERROR_MESSAGES,
    REF_SALE,
    REF_SALE_RETURN,
    SaleError,
)
from .helper import allocate, base_qty, exceeds_percent, proportional, qty_amount, round_div
from .model import Sale, SaleLine, SaleReturn, SaleReturnLine
from .repository import SaleRepository
from .schema import (
    ExchangeCreate,
    ExchangeOut,
    ReturnCreate,
    ReturnLineOut,
    ReturnListOut,
    ReturnListQuery,
    ReturnOut,
    SaleCreate,
    SaleLineOut,
    SaleListOut,
    SaleListQuery,
    SaleOut,
    SalesSummaryOut,
)
from .types import PaymentMethod, SaleFilters


class SaleService(EntityService):
    entity = ENTITY_SALE
    messages = ERROR_MESSAGES
    version_conflict_error = SaleError.DUPLICATE
    unique_conflict_error = SaleError.DUPLICATE

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = SaleRepository(session)
        self.products = ProductService(session, actor)
        self.customers = CustomerService(session, actor)
        self.treasury = TreasuryService(session, actor)
        self.shifts = ShiftService(session, actor)

    # ================= قراءة =================
    def list_sales(self, query: SaleListQuery) -> SaleListOut:
        date_from = query.date_from
        if not self.is_manager:
            # الكاشير يرى فواتير مهلة الإرجاع فقط (يكفي للمرتجع والطباعة).
            window_start = local_today() - timedelta(days=RETURN_WINDOW_DAYS)
            date_from = max(date_from or window_start, window_start)
        term = query.q.strip()
        number = int(term.lstrip("#")) if term.lstrip("#").isdigit() else None
        filters = SaleFilters(
            query=term if number is None else "",
            number=number,
            customer_id=query.customer_id,
            shift_id=query.shift_id,
            method=query.method,
            status=query.status,
            date_from=date_from,
            date_to=query.date_to,
            sort=query.sort,
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_sales(filters)
        return SaleListOut(
            items=self._sales_out(rows), total=total, page=query.page, page_size=query.page_size
        )

    def get_sale(self, sale_id: str) -> SaleOut:
        return self._sales_out([self._get_or_404(sale_id)])[0]

    def get_by_number(self, number: int) -> SaleOut:
        sale = self.repo.by_number(number)
        if sale is None:
            raise self._err(NotFoundError, SaleError.NOT_FOUND)
        return self._sales_out([sale])[0]

    def summary(self) -> SalesSummaryOut:
        today = local_today()
        day = self.repo.period_totals(today, today)
        week = self.repo.period_totals(today - timedelta(days=6), today)
        month = self.repo.period_totals(today.replace(day=1), today)
        return SalesSummaryOut(
            today_count=day.count,
            today_total=day.total,
            today_profit=day.profit,
            today_returns=day.returns,
            week_total=week.total,
            month_total=month.total,
            month_profit=month.profit,
        )

    def list_returns(self, query: ReturnListQuery) -> ReturnListOut:
        term = query.q.strip().lstrip("#")
        rows, total = self.repo.list_returns(
            sale_number=int(term) if term.isdigit() else None,
            query="" if term.isdigit() else query.q,
            reason=query.reason.value if query.reason else None,
            date_from=query.date_from,
            date_to=query.date_to,
            page=query.page,
            page_size=query.page_size,
        )
        return ReturnListOut(
            items=self._returns_out(rows), total=total, page=query.page, page_size=query.page_size
        )

    # ================= كتابة =================
    def create_sale(self, data: SaleCreate) -> SaleOut:
        existing = self.repo.by_client_ref(data.client_ref)
        if existing is not None:
            return self._sales_out([existing])[0]  # إعادة إرسال: نفس الفاتورة بدون تكرار
        shift = self.shifts.require_open()
        sale = self._create_sale(data, shift)
        self._commit_or_existing(data.client_ref)
        return self._sales_out([sale])[0]

    def create_return(self, sale_id: str, data: ReturnCreate) -> ReturnOut:
        sale = self._get_or_404(sale_id)
        shift = self.shifts.repo.current(self.actor.device_id)
        if shift is None and not self.is_manager:
            shift = self.shifts.require_open()  # يرفع خطأ "لا توجد وردية"
        ret = self._create_return(sale, data, shift, force_cash=False)
        self._commit()
        return self._returns_out([ret])[0]

    def exchange(self, data: ExchangeCreate) -> ExchangeOut:
        sale = self._get_or_404(data.sale_id)
        shift = self.shifts.require_open()
        if data.sale and self.repo.by_client_ref(data.sale.client_ref) is not None:
            raise self._err(ConflictError, SaleError.DUPLICATE)
        # كل الفرق نقدي في الاستبدال: يُرد المرتجع من الدرج ويُحصَّل الجديد فيه، فيتحرك الصافي فقط.
        ret = self._create_return(sale, data.return_data, shift, force_cash=True)
        new_sale = self._create_sale(data.sale, shift) if data.sale else None
        self._commit()
        return ExchangeOut(
            sale_return=self._returns_out([ret])[0],
            sale=self._sales_out([new_sale])[0] if new_sale else None,
        )

    # ================= داخلي: البيع =================
    def _create_sale(self, data: SaleCreate, shift: Shift) -> Sale:
        number = self.repo.next_number()
        sale_id = uuid7()
        priced: list[dict] = []
        demand: dict[str, int] = defaultdict(int)
        products: dict[str, Product] = {}

        for item in data.lines:
            product = self._product(item.product_id)
            products[product.id] = product
            factor, price, unit_name = self._unit_info(product, item.unit_id)
            if item.unit_price != price:
                raise self._err(
                    ConflictError, SaleError.PRICE_CHANGED, product=product.name, price=price
                )
            base = base_qty(item.qty, factor)
            if not product.allow_decimal and base % QTY_SCALE:
                raise self._err(BadRequestError, SaleError.FRACTION_NOT_ALLOWED, product=product.name)
            gross = qty_amount(item.qty, price)
            if item.discount > gross:
                raise self._err(BadRequestError, SaleError.LINE_DISCOUNT_TOO_HIGH, product=product.name)
            demand[product.id] += base
            priced.append(
                {
                    "product": product,
                    "unit_id": item.unit_id,
                    "unit_name": unit_name,
                    "factor": factor,
                    "qty": item.qty,
                    "base": base,
                    "price": price,
                    "gross": gross,
                    "discount": item.discount,
                }
            )

        if not ALLOW_NEGATIVE_STOCK:
            for pid, qty in demand.items():
                product = products[pid]
                if product.stock_qty - qty < 0:
                    raise self._err(
                        ConflictError,
                        SaleError.INSUFFICIENT_STOCK,
                        product=product.name,
                        available=product.stock_qty,
                    )

        subtotal = sum(p["gross"] for p in priced)
        lines_discount = sum(p["discount"] for p in priced)
        after_lines = subtotal - lines_discount
        if data.invoice_discount > after_lines:
            raise self._err(BadRequestError, SaleError.DISCOUNT_TOO_HIGH)
        if not self.is_manager and exceeds_percent(
            lines_discount + data.invoice_discount, subtotal, CASHIER_MAX_DISCOUNT_PERCENT
        ):
            raise self._err(
                ForbiddenError, SaleError.CASHIER_DISCOUNT_LIMIT, max_percent=CASHIER_MAX_DISCOUNT_PERCENT
            )
        total = after_lines - data.invoice_discount

        # بَسطة: بيع كاش فقط بدون عميل (العملاء والآجل من خطة دُكّان).
        if is_free() and (data.customer_id or data.payment_method is not PaymentMethod.CASH):
            raise upgrade_error(Feature.CUSTOMERS)
        customer = self._customer(data.customer_id)
        cash, credit, received, change = self._payment(data, total, customer)

        sale = Sale(
            id=sale_id,
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            number=number,
            client_ref=data.client_ref,
            shift_id=shift.id,
            customer_id=customer.id if customer else None,
            customer_name=customer.name if customer else None,
            sold_on=local_today(),
            payment_method=data.payment_method.value,
            subtotal=subtotal,
            lines_discount=lines_discount,
            invoice_discount=data.invoice_discount,
            total=total,
            cash_amount=cash,
            credit_amount=credit,
            received=received,
            change=change,
            note=data.note,
        )
        self.repo.add(sale)

        nets = allocate(data.invoice_discount, [p["gross"] - p["discount"] for p in priced])
        cost_total = 0
        for p, net in zip(priced, nets, strict=True):
            product: Product = p["product"]
            line_cost = round_div(p["base"] * product.cost_price, QTY_SCALE)
            cost_total += line_cost
            sale.lines.append(
                SaleLine(
                    id=uuid7(),
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    product_id=product.id,
                    unit_id=p["unit_id"],
                    name=product.name,
                    unit_name=p["unit_name"],
                    factor=p["factor"],
                    qty=p["qty"],
                    unit_price=p["price"],
                    discount=p["discount"],
                    line_total=p["gross"] - p["discount"],
                    net_total=net,
                    unit_cost=product.cost_price,
                    cost_total=line_cost,
                )
            )
            self.products.move_stock(
                product,
                MovementType.SALE,
                -p["base"],
                note=f"فاتورة بيع #{number}",
                ref_type=REF_SALE,
                ref_id=sale.id,
            )
        sale.cost_total = cost_total
        self.repo.flush()

        if customer:
            self.customers.record_purchase(customer, total)
            if credit:
                self.customers.post_entry(
                    customer,
                    LedgerType.SALE,
                    debit=credit,
                    note=f"فاتورة بيع #{number}",
                    ref_type=REF_SALE,
                    ref_id=sale.id,
                )
        if cash:
            self.treasury.post_entry(
                direction=CashDirection.IN,
                kind=CashKind.SALE,
                amount=cash,
                occurred_at=sale.sold_on,
                note=f"فاتورة بيع #{number}",
                source_entity=ENTITY_SALE,
                source_id=sale.id,
            )

        self._audit(
            sale,
            "create",
            {
                "number": number,
                "total": total,
                "cash": cash,
                "credit": credit,
                "discount": lines_discount + data.invoice_discount,
                "customer_id": sale.customer_id,
                "items": len(priced),
            },
        )
        self._enqueue_event(ENTITY_SALE, sale.id, self._sale_payload(sale))
        return sale

    def _payment(
        self, data: SaleCreate, total: int, customer: Customer | None
    ) -> tuple[int, int, int, int]:
        """(كاش، آجل، المستلم، الباقي) بعد التحقق من قواعد كل طريقة دفع."""
        method = data.payment_method
        if method is PaymentMethod.CASH:
            if data.cash_amount != total:
                raise self._err(BadRequestError, SaleError.PAYMENT_MISMATCH, total=total)
            received = data.received or total
            if received < total:
                raise self._err(BadRequestError, SaleError.CASH_SHORT, total=total)
            return total, 0, received, received - total

        if customer is None:
            raise self._err(BadRequestError, SaleError.CUSTOMER_REQUIRED)
        if method is PaymentMethod.CREDIT:
            cash = 0
        else:
            cash = data.cash_amount
            if not 0 < cash < total:
                raise self._err(BadRequestError, SaleError.PAYMENT_MISMATCH, total=total)
        credit = total - cash
        available = max(customer.credit_limit - customer.balance, 0)
        if credit > available:
            raise self._err(BadRequestError, SaleError.CREDIT_LIMIT, available=available)
        return cash, credit, cash, 0

    def _product(self, product_id: str) -> Product:
        try:
            product = self.products.get_for_update(product_id)
        except NotFoundError as exc:
            raise self._err(NotFoundError, SaleError.PRODUCT_NOT_FOUND) from exc
        if not product.is_active:
            raise self._err(ConflictError, SaleError.PRODUCT_INACTIVE, product=product.name)
        return product

    def _unit_info(self, product: Product, unit_id: str | None) -> tuple[int, int, str]:
        """(المعامل، سعر وحدة البيع، اسمها). الوحدة الإضافية بلا سعر = سعر الأساس × المعامل."""
        if not unit_id:
            return QTY_SCALE, product.sale_price, product.unit
        unit = next((u for u in product.units if u.id == unit_id), None)
        if unit is None:
            raise self._err(NotFoundError, SaleError.UNIT_NOT_FOUND)
        price = unit.sale_price or qty_amount(unit.factor, product.sale_price)
        return unit.factor, price, unit.name

    def _customer(self, customer_id: str | None) -> Customer | None:
        if not customer_id:
            return None
        customer = self.customers.get_for_update(customer_id)
        if not customer.is_active:
            raise self._err(ConflictError, SaleError.CUSTOMER_INACTIVE)
        return customer

    def _commit_or_existing(self, client_ref: str) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise self._err(ConflictError, SaleError.DUPLICATE, client_ref=client_ref) from exc

    # ================= داخلي: المرتجع =================
    def _create_return(
        self, sale: Sale, data: ReturnCreate, shift: Shift | None, *, force_cash: bool
    ) -> SaleReturn:
        if not self.is_manager and sale.sold_on < local_today() - timedelta(days=RETURN_WINDOW_DAYS):
            raise self._err(ForbiddenError, SaleError.RETURN_EXPIRED, days=RETURN_WINDOW_DAYS)

        requested: dict[str, int] = defaultdict(int)
        for item in data.lines:
            requested[item.sale_line_id] += item.qty
        by_id = {line.id: line for line in sale.lines}

        number = self.repo.next_return_number()
        ret = SaleReturn(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            number=number,
            sale_id=sale.id,
            shift_id=shift.id if shift else None,
            customer_id=sale.customer_id,
            returned_on=local_today(),
            reason=data.reason.value,
            note=data.note,
            total=0,
        )
        total = cost_total = 0
        moves: list[tuple[Product, int, SaleLine]] = []
        for line_id, qty in requested.items():
            line = by_id.get(line_id)
            if line is None:
                raise self._err(NotFoundError, SaleError.RETURN_LINE_NOT_FOUND)
            available = line.qty - line.returned_qty
            if qty > available:
                raise self._err(
                    BadRequestError, SaleError.RETURN_QTY_EXCEEDS, product=line.name, available=available
                )
            product = self.products.get_for_update(line.product_id)
            base = base_qty(qty, line.factor)
            if not product.allow_decimal and base % QTY_SCALE:
                raise self._err(BadRequestError, SaleError.FRACTION_NOT_ALLOWED, product=line.name)
            # آخر كمية متبقية تأخذ الباقي بالضبط فلا يتراكم خطأ التقريب.
            amount = (
                line.net_total - line.returned_amount
                if qty == available
                else proportional(qty, line.qty, line.net_total)
            )
            cost = proportional(qty, line.qty, line.cost_total)
            line.returned_qty += qty
            line.returned_amount += amount
            total += amount
            cost_total += cost
            ret.lines.append(
                SaleReturnLine(
                    id=uuid7(),
                    device_id=self.actor.device_id,
                    created_by=self.actor.user_id,
                    sale_line_id=line.id,
                    product_id=line.product_id,
                    name=line.name,
                    unit_name=line.unit_name,
                    qty=qty,
                    amount=amount,
                    cost_total=cost,
                )
            )
            moves.append((product, base, line))
        if not ret.lines:
            raise self._err(BadRequestError, SaleError.RETURN_EMPTY)

        customer = (
            self.customers.get_for_update(sale.customer_id) if sale.customer_id else None
        )
        credit_refund = 0
        if customer and not force_cash and sale.credit_amount > 0:
            credit_refund = min(total, max(customer.balance, 0), sale.credit_amount)
        cash_refund = total - credit_refund
        if cash_refund and shift is None and not self.is_manager:
            self.shifts.require_open()

        ret.total = total
        ret.cost_total = cost_total
        ret.cash_refund = cash_refund
        ret.credit_refund = credit_refund
        sale.returned_total += total
        self.repo.add_any(ret)
        self.repo.flush()

        for product, base, line in moves:
            self.products.move_stock(
                product,
                MovementType.SALE_RETURN,
                base,
                unit_cost=line.unit_cost,
                note=f"مرتجع #{number} من فاتورة #{sale.number}",
                ref_type=REF_SALE_RETURN,
                ref_id=ret.id,
            )
        if customer:
            customer.total_sales = max(customer.total_sales - total, 0)
            if credit_refund:
                self.customers.post_entry(
                    customer,
                    LedgerType.RETURN,
                    credit=credit_refund,
                    note=f"مرتجع #{number} من فاتورة #{sale.number}",
                    ref_type=REF_SALE_RETURN,
                    ref_id=ret.id,
                )
        if cash_refund:
            self.treasury.post_entry(
                direction=CashDirection.OUT,
                kind=CashKind.SALE_RETURN,
                amount=cash_refund,
                occurred_at=ret.returned_on,
                note=f"مرتجع #{number} من فاتورة #{sale.number}",
                source_entity=ENTITY_SALE_RETURN,
                source_id=ret.id,
            )

        self._audit(
            sale,
            "return",
            {
                "return_number": number,
                "total": total,
                "cash_refund": cash_refund,
                "credit_refund": credit_refund,
                "reason": data.reason.value,
            },
        )
        self._enqueue_event(ENTITY_SALE_RETURN, ret.id, self._return_payload(ret))
        return ret

    # ================= داخلي: عام =================
    def _get_or_404(self, sale_id: str) -> Sale:
        sale = self.repo.get(sale_id)
        if sale is None:
            raise self._err(NotFoundError, SaleError.NOT_FOUND)
        return sale

    @staticmethod
    def _sale_payload(sale: Sale) -> dict:
        return {
            "id": sale.id,
            "number": sale.number,
            "shift_id": sale.shift_id,
            "customer_id": sale.customer_id,
            "sold_on": sale.sold_on.isoformat(),
            "payment_method": sale.payment_method,
            "subtotal": sale.subtotal,
            "lines_discount": sale.lines_discount,
            "invoice_discount": sale.invoice_discount,
            "total": sale.total,
            "cash_amount": sale.cash_amount,
            "credit_amount": sale.credit_amount,
            "cost_total": sale.cost_total,
            "lines": [
                {
                    "id": l.id,
                    "product_id": l.product_id,
                    "unit_id": l.unit_id,
                    "qty": l.qty,
                    "unit_price": l.unit_price,
                    "discount": l.discount,
                    "net_total": l.net_total,
                    "unit_cost": l.unit_cost,
                }
                for l in sale.lines
            ],
        }

    @staticmethod
    def _return_payload(ret: SaleReturn) -> dict:
        return {
            "id": ret.id,
            "number": ret.number,
            "sale_id": ret.sale_id,
            "shift_id": ret.shift_id,
            "returned_on": ret.returned_on.isoformat(),
            "reason": ret.reason,
            "total": ret.total,
            "cash_refund": ret.cash_refund,
            "credit_refund": ret.credit_refund,
            "lines": [
                {"id": l.id, "sale_line_id": l.sale_line_id, "qty": l.qty, "amount": l.amount}
                for l in ret.lines
            ],
        }

    def _sales_out(self, rows: list[Sale]) -> list[SaleOut]:
        names = user_names(self.session, [s.created_by for s in rows])
        phones = self._customer_phones({s.customer_id for s in rows if s.customer_id})
        mgr = self.is_manager
        out: list[SaleOut] = []
        for s in rows:
            net_cost = s.cost_total - sum(
                proportional(l.returned_qty, l.qty, l.cost_total) for l in s.lines
            )
            out.append(
                SaleOut(
                    id=s.id,
                    number=s.number,
                    sold_at=s.created_at,
                    sold_on=s.sold_on,
                    customer_id=s.customer_id,
                    customer_name=s.customer_name,
                    customer_phone=phones.get(s.customer_id) if s.customer_id else None,
                    cashier_name=names.get(s.created_by or ""),
                    payment_method=s.payment_method,
                    subtotal=s.subtotal,
                    lines_discount=s.lines_discount,
                    invoice_discount=s.invoice_discount,
                    total=s.total,
                    cash_amount=s.cash_amount,
                    credit_amount=s.credit_amount,
                    received=s.received,
                    change=s.change,
                    returned_total=s.returned_total,
                    cost_total=s.cost_total if mgr else None,
                    profit=(s.total - s.returned_total) - net_cost if mgr else None,
                    note=s.note,
                    lines=[
                        SaleLineOut(
                            id=l.id,
                            product_id=l.product_id,
                            unit_id=l.unit_id,
                            name=l.name,
                            unit_name=l.unit_name,
                            factor=l.factor,
                            qty=l.qty,
                            unit_price=l.unit_price,
                            discount=l.discount,
                            line_total=l.line_total,
                            net_total=l.net_total,
                            returned_qty=l.returned_qty,
                            unit_cost=l.unit_cost if mgr else None,
                        )
                        for l in s.lines
                    ],
                )
            )
        return out

    def _returns_out(self, rows: list[SaleReturn]) -> list[ReturnOut]:
        sale_ids = {r.sale_id for r in rows}
        numbers = self.repo.sale_numbers(sale_ids)
        customers = self.repo.customer_names(sale_ids)
        names = user_names(self.session, [r.created_by for r in rows])
        return [
            ReturnOut(
                id=r.id,
                number=r.number,
                sale_id=r.sale_id,
                sale_number=numbers.get(r.sale_id, 0),
                returned_at=r.created_at,
                returned_on=r.returned_on,
                reason=r.reason,
                note=r.note,
                customer_name=customers.get(r.sale_id),
                cashier_name=names.get(r.created_by or ""),
                total=r.total,
                cash_refund=r.cash_refund,
                credit_refund=r.credit_refund,
                lines=[
                    ReturnLineOut(
                        id=l.id,
                        sale_line_id=l.sale_line_id,
                        product_id=l.product_id,
                        name=l.name,
                        unit_name=l.unit_name,
                        qty=l.qty,
                        amount=l.amount,
                    )
                    for l in r.lines
                ],
            )
            for r in rows
        ]

    def _customer_phones(self, ids: set[str]) -> dict[str, str | None]:
        if not ids:
            return {}
        from sqlalchemy import select

        rows = self.session.execute(select(Customer.id, Customer.phone).where(Customer.id.in_(ids)))
        return {cid: phone for cid, phone in rows.all()}
