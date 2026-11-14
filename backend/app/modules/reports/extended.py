"""تقارير الميزات الإضافية: المشتريات، العروض، المرتجعات، العملاء ونقاط الولاء، الكاشيرية والورديات.

قراءة فقط ولا تعرض إلا للمدير. المال بالقروش والكميات بالوحدة الأساسية × 1000.
كل تقرير يُفرض بخطته في routes.py (المشتريات ← الموردين، العملاء ← العملاء).
"""

from collections import defaultdict
from datetime import date, datetime, timedelta

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import QTY_SCALE
from app.core.lookups import user_names
from app.core.periods import day_bounds_utc, local_today
from app.core.repository import live
from app.core.security import Actor
from app.modules.customers.model import Customer
from app.modules.loyalty.model import LoyaltyEntry
from app.modules.products.model import Product
from app.modules.promotions.model import Promotion
from app.modules.promotions.service import promo_status
from app.modules.purchase_orders.constants import OrderStatus
from app.modules.purchase_orders.model import PurchaseOrder
from app.modules.purchases.model import Purchase, PurchaseLine, PurchaseReturn
from app.modules.sales.model import Sale, SaleLine, SaleReturn, SaleReturnLine
from app.modules.settings.service import SettingsService
from app.modules.shifts.model import Shift

from .schema import NamedValueOut, RangeQuery

TOP_ROWS = 20
# طلب مُرسل للمورد ولم يصل بعد هذه المدة = متأخر.
LATE_ORDER_DAYS = 3
# عميل لم يشترِ منذ هذه المدة = انقطع.
LAPSED_DAYS = 30
# تغيّر سعر الشراء أقل من هذا (%) لا يُعرض.
PRICE_CHANGE_MIN_PCT = 1


def _aware(value: datetime) -> datetime:
    from datetime import timezone

    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# ================= Schemas =================
class SupplierPurchasesOut(BaseModel):
    id: str
    name: str
    total: int
    count: int
    returned: int


class PurchasedProductOut(BaseModel):
    product_id: str
    name: str
    unit: str
    qty: int  # وحدة أساسية × 1000
    total: int
    first_cost: int  # تكلفة الوحدة الأساسية أول الفترة
    last_cost: int  # وآخرها
    change_pct: float  # (آخر − أول) / أول × 100


class LateOrderOut(BaseModel):
    id: str
    number: int
    supplier_name: str
    total: int
    sent_at: datetime
    days: int


class PurchasesReportOut(BaseModel):
    total: int
    count: int
    paid: int
    credit: int
    discount: int
    returned: int  # مرتجع المشتريات في الفترة
    net: int  # total - returned
    by_supplier: list[SupplierPurchasesOut]
    top_products: list[PurchasedProductOut]
    price_changes: list[PurchasedProductOut]
    draft_orders: int
    sent_orders: int
    open_orders_total: int
    received_orders: int  # طلبات استُلمت في الفترة
    late_orders: list[LateOrderOut]


class PromoRowOut(BaseModel):
    id: str | None  # None = عرض حُذف (يظهر باسمه من سطور البيع)
    name: str
    kind: str | None
    status: str | None
    starts_on: date | None
    ends_on: date | None
    discount: int
    lines: int
    invoices: int
    qty: int  # وحدات أساسية × 1000 بيعت بالعرض
    revenue: int  # المدفوع فعلاً في سطور العرض


class PromotionsReportOut(BaseModel):
    discount: int
    invoices: int
    sales_count: int  # كل الفواتير في الفترة (لنسبة الفواتير التي فيها عرض)
    manual_discount: int  # خصم الكاشير على السطور + خصم الفاتورة (للمقارنة)
    promos: list[PromoRowOut]


class ReturnedProductOut(BaseModel):
    product_id: str
    name: str
    unit: str
    qty: int  # وحدات أساسية × 1000
    amount: int
    times: int


class CashierReturnsOut(BaseModel):
    user_id: str
    name: str
    count: int
    total: int


class ReturnsReportOut(BaseModel):
    count: int
    total: int
    cash_refund: int
    credit_refund: int
    wallet_refund: int
    revenue: int  # مبيعات الفترة (لنسبة المرتجع)
    by_reason: list[NamedValueOut]  # value = القيمة، extra = العدد
    top_products: list[ReturnedProductOut]
    by_cashier: list[CashierReturnsOut]


class CustomerRowOut(BaseModel):
    id: str
    name: str
    phone: str | None
    net: int  # صافي المشتريات بعد المرتجع
    invoices: int
    avg_ticket: int
    last_at: datetime | None
    points: int


class LapsedCustomerOut(BaseModel):
    id: str
    name: str
    phone: str | None
    last_at: datetime
    days: int
    lifetime: int  # كل مشترياته


class LoyaltyReportOut(BaseModel):
    enabled: bool
    earned: int
    redeemed: int
    redeem_value: int
    adjusted: int  # تعديلات المدير اليدوية في الفترة (موقّعة)
    outstanding_points: int
    outstanding_value: int
    members: int
    top_balances: list[NamedValueOut]  # value = النقاط، extra = قيمتها بالقروش


class CustomersReportOut(BaseModel):
    total_customers: int
    active: int
    new: int
    walk_in_sales: int  # مبيعات بدون عميل مسجّل
    customer_sales: int  # مبيعات لعملاء مسجلين
    top: list[CustomerRowOut]
    lapsed: list[LapsedCustomerOut]
    loyalty: LoyaltyReportOut


class CashierRowOut(BaseModel):
    user_id: str
    name: str
    invoices: int
    sales: int
    returns: int
    returns_count: int
    net: int
    avg_ticket: int
    manual_discount: int  # خصم يدوي (سطور + فاتورة)
    promo_discount: int  # عروض تلقائية (ليست قرار الكاشير)
    shifts: int
    shortage: int  # مجموع العجز (موجب)
    overage: int  # مجموع الزيادة
    worst_diff: int  # أكبر عجز في وردية واحدة (سالب) أو 0


class ShiftDiffOut(BaseModel):
    id: str
    cashier_name: str
    opened_at: datetime
    closed_at: datetime | None
    expected: int
    counted: int
    difference: int


class CashiersReportOut(BaseModel):
    cashiers: list[CashierRowOut]
    shifts_count: int
    open_shifts: int
    shortage: int
    overage: int
    differences: list[ShiftDiffOut]  # الورديات التي بها عجز أو زيادة، الأكبر أولاً


# ================= الخدمة =================
class ExtendedReportService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    # ---------- المشتريات ----------
    def purchases(self, q: RangeQuery) -> PurchasesReportOut:
        s = self.session
        in_range = (live(Purchase), Purchase.purchased_on.between(q.date_from, q.date_to))
        total, count, paid, credit, discount = s.execute(
            select(
                func.coalesce(func.sum(Purchase.total), 0),
                func.count(),
                func.coalesce(func.sum(Purchase.paid_amount), 0),
                func.coalesce(func.sum(Purchase.credit_amount), 0),
                func.coalesce(func.sum(Purchase.discount), 0),
            ).where(*in_range)
        ).one()
        returned = s.scalar(
            select(func.coalesce(func.sum(PurchaseReturn.total), 0)).where(
                live(PurchaseReturn), PurchaseReturn.returned_on.between(q.date_from, q.date_to)
            )
        ) or 0

        ret_by_supplier = dict(
            s.execute(
                select(PurchaseReturn.supplier_id, func.sum(PurchaseReturn.total))
                .where(live(PurchaseReturn), PurchaseReturn.returned_on.between(q.date_from, q.date_to))
                .group_by(PurchaseReturn.supplier_id)
            ).all()
        )
        by_supplier = [
            SupplierPurchasesOut(
                id=sid, name=name, total=int(t or 0), count=int(c), returned=int(ret_by_supplier.get(sid) or 0)
            )
            for sid, name, t, c in s.execute(
                select(Purchase.supplier_id, func.max(Purchase.supplier_name), func.sum(Purchase.total), func.count())
                .where(*in_range)
                .group_by(Purchase.supplier_id)
                .order_by(func.sum(Purchase.total).desc())
            ).all()
        ]

        # الأصناف: الكمية والتكلفة، وأول/آخر تكلفة للوحدة الأساسية في الفترة.
        lines = s.execute(
            select(
                PurchaseLine.product_id,
                PurchaseLine.name,
                PurchaseLine.qty * PurchaseLine.factor / QTY_SCALE,
                PurchaseLine.net_total,
                PurchaseLine.base_cost,
            )
            .join(Purchase, Purchase.id == PurchaseLine.purchase_id)
            .where(*in_range)
            .order_by(Purchase.purchased_on, Purchase.number)
        ).all()
        agg: dict[str, dict] = {}
        for pid, name, qty, line_total, base_cost in lines:
            a = agg.setdefault(pid, {"name": name, "qty": 0, "total": 0, "first": base_cost, "last": base_cost})
            a["qty"] += int(qty or 0)
            a["total"] += int(line_total or 0)
            a["last"] = base_cost
        units = dict(s.execute(select(Product.id, Product.unit).where(Product.id.in_(agg))).all()) if agg else {}

        def row(pid: str, a: dict) -> PurchasedProductOut:
            change = (a["last"] - a["first"]) / a["first"] * 100 if a["first"] else 0.0
            return PurchasedProductOut(
                product_id=pid,
                name=a["name"],
                unit=units.get(pid, ""),
                qty=a["qty"],
                total=a["total"],
                first_cost=a["first"],
                last_cost=a["last"],
                change_pct=round(change, 1),
            )

        rows = [row(pid, a) for pid, a in agg.items()]
        top_products = sorted(rows, key=lambda r: -r.total)[:TOP_ROWS]
        price_changes = sorted(
            (r for r in rows if abs(r.change_pct) >= PRICE_CHANGE_MIN_PCT),
            key=lambda r: -abs(r.change_pct),
        )[:TOP_ROWS]

        # طلبات الشراء.
        open_rows = s.execute(
            select(PurchaseOrder).where(
                live(PurchaseOrder),
                PurchaseOrder.status.in_([OrderStatus.DRAFT.value, OrderStatus.SENT.value]),
            )
        ).scalars().all()
        now = datetime.now().astimezone()
        late = [
            LateOrderOut(
                id=o.id,
                number=o.number,
                supplier_name=o.supplier_name,
                total=o.total,
                sent_at=o.sent_at,
                days=(now - _aware(o.sent_at)).days,
            )
            for o in open_rows
            if o.status == OrderStatus.SENT.value
            and o.sent_at
            and (now - _aware(o.sent_at)).days >= LATE_ORDER_DAYS
        ]
        late.sort(key=lambda o: -o.days)
        start, end = day_bounds_utc(q.date_from, q.date_to)
        received = s.scalar(
            select(func.count()).where(
                live(PurchaseOrder),
                PurchaseOrder.status == OrderStatus.RECEIVED.value,
                PurchaseOrder.closed_at >= start,
                PurchaseOrder.closed_at < end,
            )
        )

        return PurchasesReportOut(
            total=int(total),
            count=int(count),
            paid=int(paid),
            credit=int(credit),
            discount=int(discount),
            returned=int(returned),
            net=int(total) - int(returned),
            by_supplier=by_supplier,
            top_products=top_products,
            price_changes=price_changes,
            draft_orders=sum(1 for o in open_rows if o.status == OrderStatus.DRAFT.value),
            sent_orders=sum(1 for o in open_rows if o.status == OrderStatus.SENT.value),
            open_orders_total=sum(o.total for o in open_rows),
            received_orders=int(received or 0),
            late_orders=late,
        )

    # ---------- العروض ----------
    def promotions(self, q: RangeQuery) -> PromotionsReportOut:
        s = self.session
        in_range = (live(Sale), Sale.sold_on.between(q.date_from, q.date_to))
        discount, invoices, sales_count, manual = s.execute(
            select(
                func.coalesce(func.sum(Sale.promo_discount), 0),
                func.count().filter(Sale.promo_discount > 0),
                func.count(),
                func.coalesce(func.sum(Sale.lines_discount + Sale.invoice_discount), 0),
            ).where(*in_range)
        ).one()

        stats = {
            name: (int(d or 0), int(n), int(inv), int(qty or 0), int(rev or 0))
            for name, d, n, inv, qty, rev in s.execute(
                select(
                    SaleLine.promo_name,
                    func.sum(SaleLine.promo_discount),
                    func.count(),
                    func.count(func.distinct(SaleLine.sale_id)),
                    func.sum(SaleLine.qty * SaleLine.factor / QTY_SCALE),
                    func.sum(SaleLine.net_total),
                )
                .join(Sale, Sale.id == SaleLine.sale_id)
                .where(*in_range, SaleLine.promo_discount > 0, SaleLine.promo_name.is_not(None))
                .group_by(SaleLine.promo_name)
            ).all()
        }

        today = local_today()
        promos: list[PromoRowOut] = []
        seen: set[str] = set()
        for p in s.scalars(select(Promotion).where(live(Promotion)).order_by(Promotion.id)).all():
            d, n, inv, qty, rev = stats.get(p.name, (0, 0, 0, 0, 0))
            seen.add(p.name)
            promos.append(
                PromoRowOut(
                    id=p.id, name=p.name, kind=p.kind, status=promo_status(p, today).value,
                    starts_on=p.starts_on, ends_on=p.ends_on,
                    discount=d, lines=n, invoices=inv, qty=qty, revenue=rev,
                )
            )  # fmt: skip
        # عروض حُذفت لكنها طُبقت في الفترة.
        for name, (d, n, inv, qty, rev) in stats.items():
            if name not in seen:
                promos.append(
                    PromoRowOut(
                        id=None, name=name, kind=None, status=None, starts_on=None, ends_on=None,
                        discount=d, lines=n, invoices=inv, qty=qty, revenue=rev,
                    )
                )  # fmt: skip
        promos.sort(key=lambda r: (-r.discount, r.name))
        return PromotionsReportOut(
            discount=int(discount),
            invoices=int(invoices),
            sales_count=int(sales_count),
            manual_discount=int(manual),
            promos=promos,
        )

    # ---------- المرتجعات ----------
    def returns(self, q: RangeQuery) -> ReturnsReportOut:
        s = self.session
        in_range = (live(SaleReturn), SaleReturn.returned_on.between(q.date_from, q.date_to))
        count, total, cash, credit, wallet = s.execute(
            select(
                func.count(),
                func.coalesce(func.sum(SaleReturn.total), 0),
                func.coalesce(func.sum(SaleReturn.cash_refund), 0),
                func.coalesce(func.sum(SaleReturn.credit_refund), 0),
                func.coalesce(func.sum(SaleReturn.wallet_refund), 0),
            ).where(*in_range)
        ).one()
        revenue = s.scalar(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                live(Sale), Sale.sold_on.between(q.date_from, q.date_to)
            )
        ) or 0

        by_reason = [
            NamedValueOut(key=r, label=r, value=int(t or 0), extra=int(n))
            for r, t, n in s.execute(
                select(SaleReturn.reason, func.sum(SaleReturn.total), func.count())
                .where(*in_range)
                .group_by(SaleReturn.reason)
                .order_by(func.sum(SaleReturn.total).desc())
            ).all()
        ]

        products = s.execute(
            select(
                SaleReturnLine.product_id,
                func.max(SaleReturnLine.name),
                func.sum(SaleReturnLine.qty * SaleLine.factor / QTY_SCALE),
                func.sum(SaleReturnLine.amount),
                func.count(),
            )
            .join(SaleReturn, SaleReturn.id == SaleReturnLine.return_id)
            .join(SaleLine, SaleLine.id == SaleReturnLine.sale_line_id)
            .where(*in_range)
            .group_by(SaleReturnLine.product_id)
            .order_by(func.sum(SaleReturnLine.amount).desc())
            .limit(TOP_ROWS)
        ).all()
        units = (
            dict(s.execute(select(Product.id, Product.unit).where(Product.id.in_([r[0] for r in products]))).all())
            if products
            else {}
        )
        top_products = [
            ReturnedProductOut(
                product_id=pid, name=name, unit=units.get(pid, ""),
                qty=int(qty or 0), amount=int(amount or 0), times=int(times),
            )
            for pid, name, qty, amount, times in products
        ]  # fmt: skip

        cashier_rows = s.execute(
            select(SaleReturn.created_by, func.count(), func.sum(SaleReturn.total))
            .where(*in_range)
            .group_by(SaleReturn.created_by)
            .order_by(func.sum(SaleReturn.total).desc())
        ).all()
        names = user_names(s, [u for u, *_ in cashier_rows if u])
        by_cashier = [
            CashierReturnsOut(user_id=u or "", name=names.get(u or "", "—"), count=int(c), total=int(t or 0))
            for u, c, t in cashier_rows
        ]
        return ReturnsReportOut(
            count=int(count),
            total=int(total),
            cash_refund=int(cash),
            credit_refund=int(credit),
            wallet_refund=int(wallet),
            revenue=int(revenue),
            by_reason=by_reason,
            top_products=top_products,
            by_cashier=by_cashier,
        )

    # ---------- العملاء ونقاط الولاء ----------
    def customers(self, q: RangeQuery) -> CustomersReportOut:
        s = self.session
        in_range = (live(Sale), Sale.sold_on.between(q.date_from, q.date_to))
        net_expr = Sale.total - Sale.returned_total
        walk_in, with_customer = s.execute(
            select(
                func.coalesce(func.sum(net_expr).filter(Sale.customer_id.is_(None)), 0),
                func.coalesce(func.sum(net_expr).filter(Sale.customer_id.is_not(None)), 0),
            ).where(*in_range)
        ).one()

        top_rows = s.execute(
            select(Sale.customer_id, func.sum(net_expr), func.count(), func.max(Sale.created_at))
            .where(*in_range, Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
            .order_by(func.sum(net_expr).desc())
            .limit(TOP_ROWS)
        ).all()
        ids = [r[0] for r in top_rows]
        customers = {c.id: c for c in s.scalars(select(Customer).where(Customer.id.in_(ids))).all()} if ids else {}
        top = [
            CustomerRowOut(
                id=cid,
                name=customers[cid].name if cid in customers else "—",
                phone=customers[cid].phone if cid in customers else None,
                net=int(t or 0),
                invoices=int(n),
                avg_ticket=int(t or 0) // int(n) if n else 0,
                last_at=last,
                points=customers[cid].loyalty_points if cid in customers else 0,
            )
            for cid, t, n, last in top_rows
        ]

        # انقطعوا: آخر شراء قبل LAPSED_DAYS (من اليوم)، الأكبر مشتريات أولاً.
        cutoff = local_today() - timedelta(days=LAPSED_DAYS)
        lapsed_rows = s.execute(
            select(Sale.customer_id, func.max(Sale.sold_on), func.max(Sale.created_at), func.sum(net_expr))
            .where(live(Sale), Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
            .having(func.max(Sale.sold_on) < cutoff)
            .order_by(func.sum(net_expr).desc())
            .limit(TOP_ROWS)
        ).all()
        lids = [r[0] for r in lapsed_rows]
        lapsed_customers = (
            {c.id: c for c in s.scalars(select(Customer).where(Customer.id.in_(lids), live(Customer))).all()}
            if lids
            else {}
        )
        today = local_today()
        lapsed = [
            LapsedCustomerOut(
                id=cid,
                name=lapsed_customers[cid].name,
                phone=lapsed_customers[cid].phone,
                last_at=last_at,
                days=(today - last_day).days,
                lifetime=int(t or 0),
            )
            for cid, last_day, last_at, t in lapsed_rows
            if cid in lapsed_customers
        ]

        start, end = day_bounds_utc(q.date_from, q.date_to)
        total_customers = s.scalar(select(func.count()).where(live(Customer))) or 0
        new = s.scalar(
            select(func.count()).where(live(Customer), Customer.created_at >= start, Customer.created_at < end)
        ) or 0
        active = s.scalar(
            select(func.count(func.distinct(Sale.customer_id))).where(*in_range, Sale.customer_id.is_not(None))
        ) or 0

        return CustomersReportOut(
            total_customers=int(total_customers),
            active=int(active),
            new=int(new),
            walk_in_sales=int(walk_in),
            customer_sales=int(with_customer),
            top=top,
            lapsed=lapsed,
            loyalty=self._loyalty(q, start, end),
        )

    def _loyalty(self, q: RangeQuery, start: datetime, end: datetime) -> LoyaltyReportOut:
        s = self.session
        cfg = SettingsService(s).loyalty()
        earned, redeemed, value = s.execute(
            select(
                func.coalesce(func.sum(Sale.loyalty_earned - Sale.loyalty_earn_reversed), 0),
                func.coalesce(func.sum(Sale.loyalty_redeemed - Sale.loyalty_redeem_restored), 0),
                func.coalesce(func.sum(Sale.loyalty_discount), 0),
            ).where(live(Sale), Sale.sold_on.between(q.date_from, q.date_to))
        ).one()
        adjusted = s.scalar(
            select(func.coalesce(func.sum(LoyaltyEntry.points), 0)).where(
                LoyaltyEntry.kind == "adjust", LoyaltyEntry.created_at >= start, LoyaltyEntry.created_at < end
            )
        ) or 0
        block_value = (Customer.loyalty_points // cfg.redeem_points) * cfg.redeem_value
        points, owed, members = s.execute(
            select(
                func.coalesce(func.sum(Customer.loyalty_points), 0),
                func.coalesce(func.sum(block_value), 0),
                func.count().filter(Customer.loyalty_points > 0),
            ).where(live(Customer))
        ).one()
        top_balances = [
            NamedValueOut(key=cid, label=name, value=int(pts), extra=int(pts) // cfg.redeem_points * cfg.redeem_value)
            for cid, name, pts in s.execute(
                select(Customer.id, Customer.name, Customer.loyalty_points)
                .where(live(Customer), Customer.loyalty_points > 0)
                .order_by(Customer.loyalty_points.desc())
                .limit(10)
            ).all()
        ]
        return LoyaltyReportOut(
            enabled=cfg.enabled,
            earned=int(earned),
            redeemed=int(redeemed),
            redeem_value=int(value),
            adjusted=int(adjusted),
            outstanding_points=int(points),
            outstanding_value=int(owed),
            members=int(members),
            top_balances=top_balances,
        )

    # ---------- الكاشيرية والورديات ----------
    def cashiers(self, q: RangeQuery) -> CashiersReportOut:
        s = self.session
        rows: dict[str, dict] = defaultdict(
            lambda: dict(invoices=0, sales=0, returns=0, returns_count=0, manual=0, promo=0,
                         shifts=0, shortage=0, overage=0, worst=0)
        )  # fmt: skip
        for u, n, total, manual, promo in s.execute(
            select(
                Sale.created_by,
                func.count(),
                func.sum(Sale.total),
                func.sum(Sale.lines_discount + Sale.invoice_discount),
                func.sum(Sale.promo_discount),
            )
            .where(live(Sale), Sale.sold_on.between(q.date_from, q.date_to))
            .group_by(Sale.created_by)
        ).all():
            r = rows[u or ""]
            r.update(invoices=int(n), sales=int(total or 0), manual=int(manual or 0), promo=int(promo or 0))
        for u, n, total in s.execute(
            select(SaleReturn.created_by, func.count(), func.sum(SaleReturn.total))
            .where(live(SaleReturn), SaleReturn.returned_on.between(q.date_from, q.date_to))
            .group_by(SaleReturn.created_by)
        ).all():
            rows[u or ""].update(returns=int(total or 0), returns_count=int(n))

        start, end = day_bounds_utc(q.date_from, q.date_to)
        shifts = s.scalars(
            select(Shift).where(live(Shift), Shift.opened_at >= start, Shift.opened_at < end)
        ).all()
        for sh in shifts:
            r = rows[sh.cashier_id]
            r["shifts"] += 1
            diff = sh.difference or 0
            if diff < 0:
                r["shortage"] += -diff
                r["worst"] = min(r["worst"], diff)
            elif diff > 0:
                r["overage"] += diff

        names = user_names(s, [u for u in rows if u] + [sh.cashier_id for sh in shifts])
        cashiers = sorted(
            (
                CashierRowOut(
                    user_id=u,
                    name=names.get(u, "—"),
                    invoices=r["invoices"],
                    sales=r["sales"],
                    returns=r["returns"],
                    returns_count=r["returns_count"],
                    net=r["sales"] - r["returns"],
                    avg_ticket=r["sales"] // r["invoices"] if r["invoices"] else 0,
                    manual_discount=r["manual"],
                    promo_discount=r["promo"],
                    shifts=r["shifts"],
                    shortage=r["shortage"],
                    overage=r["overage"],
                    worst_diff=r["worst"],
                )
                for u, r in rows.items()
            ),
            key=lambda c: -c.net,
        )
        differences = sorted(
            (
                ShiftDiffOut(
                    id=sh.id,
                    cashier_name=names.get(sh.cashier_id, "—"),
                    opened_at=sh.opened_at,
                    closed_at=sh.closed_at,
                    expected=sh.expected_cash or 0,
                    counted=sh.counted_cash or 0,
                    difference=sh.difference or 0,
                )
                for sh in shifts
                if sh.difference
            ),
            key=lambda d: abs(d.difference),
            reverse=True,
        )[:TOP_ROWS]
        return CashiersReportOut(
            cashiers=cashiers,
            shifts_count=len(shifts),
            open_shifts=sum(1 for sh in shifts if sh.is_open),
            shortage=sum(c.shortage for c in cashiers),
            overage=sum(c.overage for c in cashiers),
            differences=differences,
        )
