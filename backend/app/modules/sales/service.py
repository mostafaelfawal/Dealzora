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
from app.modules.products.model import Product, ProductUnit
from app.modules.products.service import ProductService
from app.modules.products.types import MovementType
from app.modules.promotions.service import active_promotions
from app.modules.shifts.model import Shift
from app.modules.shifts.service import ShiftService
from app.modules.treasury.service import TreasuryService
from app.modules.treasury.types import CashDirection, CashKind

from .constants import (
    ALLOW_NEGATIVE_STOCK,
    ENTITY_SALE,
    ENTITY_SALE_RETURN,
    ERROR_MESSAGES,
    REF_SALE,
    REF_SALE_RETURN,
    SaleError,
)
from .helper import base_qty, exceeds_percent, proportional, round_div
from .model import Sale, SaleLine, SaleReturn, SaleReturnLine
from .pricing import LineInput, price_lines
from app.modules.loyalty.config import earned_points, max_redeemable, redeem_discount
from app.modules.loyalty.service import LoyaltyKind, load_config as load_loyalty, post as post_points
from app.modules.e_receipt.service import issue_return_receipt, issue_sale_receipt
from app.modules.tax.calc import TaxLineIn, compute_invoice, return_split
from app.modules.tax.config import tax_mode
from app.modules.tax.service import load_config as load_tax
from .repository import SaleRepository
from .schema import (
    EtaPrintOut,
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
from app.modules.settings.payments import is_electronic, method_label

from .types import PaymentMethod, RefundVia, SaleFilters


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

    def get_return(self, return_id: str) -> ReturnOut:
        ret = self.session.get(SaleReturn, return_id)
        if ret is None or ret.deleted_at is not None:
            raise self._err(NotFoundError, SaleError.RETURN_NOT_FOUND)
        return self._returns_out([ret])[0]

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

        # العميل قبل التسعير: «عميل الجملة» يغيّر سعر الأصناف.
        customer = self._customer(data.customer_id)
        inputs: list[LineInput] = []
        for item in data.lines:
            product = self._product(item.product_id)
            products[product.id] = product
            inputs.append(LineInput(product, self._unit(product, item.unit_id), item.qty))
        prices = price_lines(
            inputs,
            wholesale_customer=bool(customer and customer.is_wholesale),
            promos=active_promotions(self.session),
        )

        for item, line, lp in zip(data.lines, inputs, prices, strict=True):
            product = line.product
            if item.unit_price != lp.price:
                raise self._err(
                    ConflictError, SaleError.PRICE_CHANGED, product=product.name, price=lp.price
                )
            if item.promo_discount != lp.promo:
                raise self._err(
                    ConflictError, SaleError.PROMO_CHANGED, product=product.name, promo=lp.promo
                )
            if not product.allow_decimal and lp.base % QTY_SCALE:
                raise self._err(BadRequestError, SaleError.FRACTION_NOT_ALLOWED, product=product.name)
            if item.discount > lp.gross - lp.promo:
                raise self._err(BadRequestError, SaleError.LINE_DISCOUNT_TOO_HIGH, product=product.name)
            demand[product.id] += lp.base
            priced.append(
                {
                    "product": product,
                    "unit_id": item.unit_id,
                    "unit_name": lp.unit_name,
                    "factor": lp.factor,
                    "qty": item.qty,
                    "base": lp.base,
                    "price": lp.price,
                    "gross": lp.gross,
                    "promo": lp.promo,
                    "promo_name": lp.promo_name,
                    "wholesale": lp.wholesale,
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
        promo_discount = sum(p["promo"] for p in priced)
        lines_discount = sum(p["discount"] for p in priced)
        after_lines = subtotal - promo_discount - lines_discount
        if data.invoice_discount > after_lines:
            raise self._err(BadRequestError, SaleError.DISCOUNT_TOO_HIGH)
        if not self.is_manager:
            from app.modules.settings.service import SettingsService

            limit = SettingsService(self.session).discount_limit()
            if limit.enabled and exceeds_percent(
                lines_discount + data.invoice_discount, subtotal - promo_discount, limit.max_percent
            ):
                raise self._err(ForbiddenError, SaleError.CASHIER_DISCOUNT_LIMIT, max_percent=limit.max_percent)
        # نقاط الولاء: الاستبدال خصم بعد خصم الفاتورة، والكسب على المدفوع فعلاً.
        loyalty = load_loyalty(self.session)
        loyalty_discount = 0
        if data.redeem_points:
            if not loyalty.enabled or customer is None:
                raise self._err(BadRequestError, SaleError.LOYALTY_UNAVAILABLE)
            if data.redeem_points % loyalty.redeem_points:
                raise self._err(BadRequestError, SaleError.LOYALTY_BLOCKS, block=loyalty.redeem_points)
            allowed = max_redeemable(
                loyalty, customer.loyalty_points, after_lines - data.invoice_discount
            )
            if data.redeem_points > allowed:
                raise self._err(ConflictError, SaleError.LOYALTY_TOO_MANY, max=allowed)
            loyalty_discount = redeem_discount(loyalty, data.redeem_points)
        # الضريبة بعد كل الخصومات (الترتيب موثّق في tax/calc.py). متوقفة أو شاملة: الإجمالي
        # = after_lines - الخصومات كما كان بالضبط، وغير شاملة: + ضريبة السطور.
        invoice_tax = compute_invoice(
            [
                TaxLineIn(
                    amount=p["gross"] - p["promo"] - p["discount"],
                    tax_type=p["product"].tax_type,
                    rate=p["product"].tax_rate,
                )
                for p in priced
            ],
            data.invoice_discount + loyalty_discount,
            tax_mode(load_tax(self.session)),
        )
        total = invoice_tax.total
        earned = earned_points(loyalty, total) if customer else 0

        # بَسطة: بيع كاش فقط بدون عميل (العملاء والآجل والمحافظ من خطة دُكّان).
        if is_free():
            if is_electronic(data.payment_method):
                raise upgrade_error(Feature.WALLETS)
            if data.customer_id or data.payment_method != PaymentMethod.CASH:
                raise upgrade_error(Feature.CUSTOMERS)
        label = self._electronic_label(data.payment_method) if is_electronic(data.payment_method) else None
        cash, credit, wallet, received, change = self._payment(data, total, customer)

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
            payment_method=data.payment_method,
            payment_label=label,
            subtotal=subtotal,
            lines_discount=lines_discount,
            promo_discount=promo_discount,
            invoice_discount=data.invoice_discount,
            loyalty_redeemed=data.redeem_points,
            loyalty_discount=loyalty_discount,
            loyalty_earned=earned,
            tax_mode=invoice_tax.mode.value,
            taxable_total=invoice_tax.taxable,
            tax_total=invoice_tax.tax,
            total=total,
            cash_amount=cash,
            credit_amount=credit,
            wallet_amount=wallet,
            payment_ref=data.payment_ref if wallet else None,
            received=received,
            change=change,
            note=data.note,
        )
        self.repo.add(sale)

        cost_total = 0
        for p, tl in zip(priced, invoice_tax.lines, strict=True):
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
                    promo_discount=p["promo"],
                    promo_name=p["promo_name"],
                    is_wholesale=p["wholesale"],
                    line_total=p["gross"] - p["promo"] - p["discount"],
                    net_total=tl.total,
                    tax_type=tl.tax_type,
                    tax_rate=tl.rate,
                    taxable_amount=tl.taxable,
                    tax_amount=tl.tax,
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
        # الإيصال الإلكتروني في نفس المعاملة (لا شيء لو الميزة متوقفة، وخطأ التحقق لا يوقف البيع).
        issue_sale_receipt(self.session, self.actor, sale)

        if customer:
            self.customers.record_purchase(customer, total)
            post_points(
                self.session, self.actor, customer, LoyaltyKind.REDEEM, -data.redeem_points,
                note=f"استبدال في فاتورة #{number}", ref_type=REF_SALE, ref_id=sale.id,
            )  # fmt: skip
            post_points(
                self.session, self.actor, customer, LoyaltyKind.EARN, earned,
                note=f"فاتورة #{number}", ref_type=REF_SALE, ref_id=sale.id,
            )  # fmt: skip
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
                "wallet": wallet,
                "payment_method": sale.payment_method,
                "payment_label": sale.payment_label,
                "payment_ref": sale.payment_ref,
                "discount": lines_discount + data.invoice_discount,
                "promo_discount": promo_discount,
                "loyalty_redeemed": data.redeem_points,
                "loyalty_earned": earned,
                "tax_mode": sale.tax_mode,
                "tax_total": sale.tax_total,
                "customer_id": sale.customer_id,
                "items": len(priced),
            },
        )
        self._enqueue_event(ENTITY_SALE, sale.id, self._sale_payload(sale))
        return sale

    def _payment(
        self, data: SaleCreate, total: int, customer: Customer | None
    ) -> tuple[int, int, int, int, int]:
        """(كاش، آجل، محفظة، المستلم، الباقي) بعد التحقق من قواعد كل طريقة دفع."""
        method = data.payment_method
        if method == PaymentMethod.CASH:
            if data.cash_amount != total:
                raise self._err(BadRequestError, SaleError.PAYMENT_MISMATCH, total=total)
            received = data.received or total
            if received < total:
                raise self._err(BadRequestError, SaleError.CASH_SHORT, total=total)
            return total, 0, 0, received, received - total

        if is_electronic(method):  # تحقّق _electronic_label من أنها مفعّلة
            return 0, 0, total, total, 0

        if customer is None:
            raise self._err(BadRequestError, SaleError.CUSTOMER_REQUIRED)
        if method == PaymentMethod.CREDIT:
            cash = 0
        else:
            cash = data.cash_amount
            if not 0 < cash < total:
                raise self._err(BadRequestError, SaleError.PAYMENT_MISMATCH, total=total)
        credit = total - cash
        available = max(customer.credit_limit - customer.balance, 0)
        if credit > available:
            raise self._err(BadRequestError, SaleError.CREDIT_LIMIT, available=available)
        return cash, credit, 0, cash, 0

    def _electronic_label(self, method: str) -> str:
        """الطريقة لازم تكون مضافة ومفعّلة في الإعدادات، وإلا الكاشير يستلم على حساب غير معروف."""
        from app.modules.settings.service import SettingsService

        found = SettingsService(self.session).payment_methods().get(method)
        if found is None or not found.enabled:
            raise self._err(
                BadRequestError, SaleError.WALLET_NOT_CONFIGURED, method=found.name if found else method_label(method)
            )
        return found.name

    def _product(self, product_id: str) -> Product:
        try:
            product = self.products.get_for_update(product_id)
        except NotFoundError as exc:
            raise self._err(NotFoundError, SaleError.PRODUCT_NOT_FOUND) from exc
        if not product.is_active:
            raise self._err(ConflictError, SaleError.PRODUCT_INACTIVE, product=product.name)
        return product

    def _unit(self, product: Product, unit_id: str | None) -> ProductUnit | None:
        if not unit_id:
            return None
        unit = next((u for u in product.units if u.id == unit_id), None)
        if unit is None:
            raise self._err(NotFoundError, SaleError.UNIT_NOT_FOUND)
        return unit

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
        tax_total: int | None = 0  # None لو الفاتورة قبل إضافة الضريبة
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
            # القيمة والضريبة بنسبة الكمية من السطر الأصلي (لا النسبة الحالية للصنف)،
            # وآخر كمية متبقية تأخذ الباقي بالضبط فلا يتراكم خطأ التقريب.
            split = return_split(
                qty=qty,
                line_qty=line.qty,
                line_total=line.net_total,
                line_tax=line.tax_amount,
                returned_qty=line.returned_qty,
                returned_amount=line.returned_amount,
                returned_tax=line.returned_tax,
            )
            amount = split.amount
            cost = proportional(qty, line.qty, line.cost_total)
            line.returned_qty += qty
            line.returned_amount += amount
            line.returned_tax += split.tax or 0
            total += amount
            cost_total += cost
            tax_total = None if tax_total is None or split.tax is None else tax_total + split.tax
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
                    taxable_amount=None if split.tax is None else amount - split.tax,
                    tax_amount=split.tax,
                    cost_total=cost,
                )
            )
            moves.append((product, base, line))
        if not ret.lines:
            raise self._err(BadRequestError, SaleError.RETURN_EMPTY)

        customer = (
            self.customers.get_for_update(sale.customer_id) if sale.customer_id else None
        )
        credit_refund = wallet_refund = 0
        if customer and not force_cash and sale.credit_amount > 0:
            credit_refund = min(total, max(customer.balance, 0), sale.credit_amount)
        if not force_cash and sale.wallet_amount > 0 and data.refund_via is RefundVia.WALLET:
            # يُرد لنفس المحفظة (المحل يحوّل للعميل)، فلا يخرج من الدرج.
            already = self.repo.wallet_refunded(sale.id)
            wallet_refund = min(total - credit_refund, max(sale.wallet_amount - already, 0))
        cash_refund = total - credit_refund - wallet_refund
        if cash_refund and shift is None and not self.is_manager:
            self.shifts.require_open()

        ret.total = total
        ret.tax_total = tax_total
        ret.taxable_total = None if tax_total is None else total - tax_total
        ret.cost_total = cost_total
        ret.cash_refund = cash_refund
        ret.credit_refund = credit_refund
        ret.wallet_refund = wallet_refund
        sale.returned_total += total
        if customer and (sale.loyalty_earned or sale.loyalty_redeemed):
            full = sale.total <= 0 or sale.returned_total >= sale.total
            left_earn = sale.loyalty_earned - sale.loyalty_earn_reversed
            left_redeem = sale.loyalty_redeemed - sale.loyalty_redeem_restored
            restore = left_redeem if full else min(left_redeem, sale.loyalty_redeemed * total // sale.total)
            reverse = left_earn if full else min(left_earn, sale.loyalty_earned * total // sale.total)
            reverse = min(reverse, customer.loyalty_points + restore)  # لا رصيد بالسالب
            sale.loyalty_redeem_restored += restore
            sale.loyalty_earn_reversed += reverse
            ret.loyalty_restored = restore
            ret.loyalty_reversed = reverse
        self.repo.add_any(ret)
        self.repo.flush()
        issue_return_receipt(self.session, self.actor, ret, sale)

        for product, base, line in moves:
            self.products.move_stock(
                product,
                MovementType.SALE_RETURN,
                base,
                unit_cost=line.unit_cost,
                note=f"مرتجع #{number} من فاتورة #{sale.number}",
                ref_type=REF_SALE_RETURN,
                ref_id=ret.id,
                origin_id=sale.id,
            )
        if customer:
            customer.total_sales = max(customer.total_sales - total, 0)
            post_points(
                self.session, self.actor, customer, LoyaltyKind.RESTORE, ret.loyalty_restored,
                note=f"رد نقاط مستبدلة — مرتجع #{number}", ref_type=REF_SALE_RETURN, ref_id=ret.id,
            )  # fmt: skip
            post_points(
                self.session, self.actor, customer, LoyaltyKind.RETURN, -ret.loyalty_reversed,
                note=f"مرتجع #{number} من فاتورة #{sale.number}", ref_type=REF_SALE_RETURN, ref_id=ret.id,
            )  # fmt: skip
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
                "wallet_refund": wallet_refund,
                "tax_total": tax_total,
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
            "tax_mode": sale.tax_mode,
            "taxable_total": sale.taxable_total,
            "tax_total": sale.tax_total,
            "total": sale.total,
            "cash_amount": sale.cash_amount,
            "credit_amount": sale.credit_amount,
            "wallet_amount": sale.wallet_amount,
            "payment_ref": sale.payment_ref,
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
                    "tax_type": l.tax_type,
                    "tax_rate": l.tax_rate,
                    "taxable_amount": l.taxable_amount,
                    "tax_amount": l.tax_amount,
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
            "taxable_total": ret.taxable_total,
            "tax_total": ret.tax_total,
            "cash_refund": ret.cash_refund,
            "credit_refund": ret.credit_refund,
            "wallet_refund": ret.wallet_refund,
            "lines": [
                {
                    "id": l.id,
                    "sale_line_id": l.sale_line_id,
                    "qty": l.qty,
                    "amount": l.amount,
                    "tax_amount": l.tax_amount,
                }
                for l in ret.lines
            ],
        }

    def _sales_out(self, rows: list[Sale]) -> list[SaleOut]:
        names = user_names(self.session, [s.created_by for s in rows])
        cids = {s.customer_id for s in rows if s.customer_id}
        phones = self._customer_phones(cids)
        points = self._customer_points(cids)
        labels = self._method_names()
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
                    payment_label=method_label(s.payment_method, s.payment_label, labels),
                    subtotal=s.subtotal,
                    lines_discount=s.lines_discount,
                    promo_discount=s.promo_discount,
                    invoice_discount=s.invoice_discount,
                    loyalty_redeemed=s.loyalty_redeemed,
                    loyalty_discount=s.loyalty_discount,
                    loyalty_earned=s.loyalty_earned,
                    customer_points=points.get(s.customer_id) if s.customer_id else None,
                    tax_mode=s.tax_mode,
                    taxable_total=s.taxable_total,
                    tax_total=s.tax_total,
                    eta_status=s.eta_status,
                    eta_uuid=s.eta_uuid,
                    eta_receipt_number=s.eta_receipt_number,
                    eta_error=s.eta_error if mgr else None,
                    eta_print=self._eta_print(s) if len(rows) == 1 else None,
                    total=s.total,
                    cash_amount=s.cash_amount,
                    credit_amount=s.credit_amount,
                    wallet_amount=s.wallet_amount,
                    payment_ref=s.payment_ref,
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
                            promo_discount=l.promo_discount,
                            promo_name=l.promo_name,
                            is_wholesale=l.is_wholesale,
                            line_total=l.line_total,
                            net_total=l.net_total,
                            tax_type=l.tax_type,
                            tax_rate=l.tax_rate,
                            taxable_amount=l.taxable_amount,
                            tax_amount=l.tax_amount,
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
                taxable_total=r.taxable_total,
                tax_total=r.tax_total,
                eta_status=r.eta_status,
                eta_uuid=r.eta_uuid,
                eta_receipt_number=r.eta_receipt_number,
                eta_error=r.eta_error,
                eta_print=self._eta_print(r) if len(rows) == 1 else None,
                cash_refund=r.cash_refund,
                credit_refund=r.credit_refund,
                wallet_refund=r.wallet_refund,
                loyalty_reversed=r.loyalty_reversed,
                loyalty_restored=r.loyalty_restored,
                lines=[
                    ReturnLineOut(
                        id=l.id,
                        sale_line_id=l.sale_line_id,
                        product_id=l.product_id,
                        name=l.name,
                        unit_name=l.unit_name,
                        qty=l.qty,
                        amount=l.amount,
                        tax_amount=l.tax_amount,
                    )
                    for l in r.lines
                ],
            )
            for r in rows
        ]

    def _eta_print(self, row: Sale | SaleReturn) -> EtaPrintOut | None:
        """QR وبيانات المنظومة للطباعة: لإيصال له UUID فقط (يُطبع فوراً حتى قبل الإرسال).
        فاتورة بلا UUID (الميزة متوقفة وقت البيع) = لا شيء، فيبقى الإيصال كما كان تماماً."""
        if not row.eta_uuid or not row.eta_document:
            return None
        from dataclasses import asdict

        from app.modules.e_receipt.qr import print_data
        from app.modules.eta.service import EtaService

        try:
            env = EtaService(self.session, self.actor).config().environment
            return EtaPrintOut(**asdict(print_data(row.eta_document, env)))
        except (ValueError, KeyError):  # مستند تالف: الطباعة لا تتعطل أبداً
            return None

    def _method_names(self) -> dict[str, str]:
        """أسماء الطرق الحالية (للفواتير القديمة التي بلا لقطة اسم)."""
        from app.modules.settings.service import SettingsService

        return {k: m.name for k, m in SettingsService(self.session).payment_methods().items()}

    def _customer_points(self, ids: set[str]) -> dict[str, int]:
        if not ids:
            return {}
        from sqlalchemy import select

        rows = self.session.execute(
            select(Customer.id, Customer.loyalty_points).where(Customer.id.in_(ids))
        )
        return {cid: pts for cid, pts in rows.all()}

    def _customer_phones(self, ids: set[str]) -> dict[str, str | None]:
        if not ids:
            return {}
        from sqlalchemy import select

        rows = self.session.execute(select(Customer.id, Customer.phone).where(Customer.id.in_(ids)))
        return {cid: phone for cid, phone in rows.all()}
