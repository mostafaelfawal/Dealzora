"""تجميع التقارير. قراءة فقط ولا تعرض إلا للمدير (التكلفة والأرباح)."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.base import utcnow
from app.core.lookups import user_names
from app.core.periods import day_bounds_utc, iter_days, local_today
from app.core.plan import Feature, has_feature
from app.modules.expenses.constants import CATEGORY_LABELS
from app.core.security import Actor
from app.modules.customers.helper import is_overdue
from app.modules.products.model import Product
from app.modules.settings.payments import method_label
from app.modules.settings.service import SettingsService
from app.modules.shifts.service import ShiftService

from .repository import ReportRepository
from .schema import (
    CashDayOut,
    CashierOut,
    CategorySalesOut,
    CustomersBriefOut,
    DebtorOut,
    DebtsReportOut,
    ExpiryBriefOut,
    HealthOut,
    HeatCellOut,
    KpisOut,
    LoyaltyBriefOut,
    NamedValueOut,
    OverviewOut,
    PayableOut,
    ProductRank,
    ProductRowOut,
    ProductsQuery,
    ProductsReportOut,
    PromotionsBriefOut,
    PurchasingBriefOut,
    RangeQuery,
    RecentSaleOut,
    SalesDayOut,
    SalesReportOut,
    ShiftBriefOut,
    StockQuery,
    StockReportOut,
    StockRowOut,
    TreasuryKindOut,
    TreasuryReportOut,
    TrendPointOut,
)

RECENT_SALES = 8
TOP_PRODUCTS = 8
TOP_CATEGORIES = 8
TOP_PROMOS = 5
NO_CATEGORY = "none"
TOP_CUSTOMERS = 5
STAGNANT_DAYS = 30
# Python: الاثنين = 0. نعيد الترقيم ليبدأ الأسبوع بالسبت (0) كما في مصر.
_SAT_FIRST = {5: 0, 6: 1, 0: 2, 1: 3, 2: 4, 3: 5, 4: 6}


class ReportService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor
        self.repo = ReportRepository(session)

    # ================= المبيعات والأرباح =================
    def sales(self, q: RangeQuery) -> SalesReportOut:
        sales = self.repo.sales_by_day(q.date_from, q.date_to)
        returns = self.repo.returns_by_day(q.date_from, q.date_to)
        days: list[SalesDayOut] = []
        tot = dict(
            count=0, revenue=0, returns=0, cost=0, discounts=0, cash=0, credit=0, wallet=0
        )
        for day in iter_days(q.date_from, q.date_to):
            count, revenue, cost, discounts, cash, credit, wallet = sales.get(
                day, (0, 0, 0, 0, 0, 0, 0)
            )
            r_total, r_cost = returns.get(day, (0, 0))
            net_cost = cost - r_cost
            net = revenue - r_total
            days.append(
                SalesDayOut(
                    day=day,
                    count=count,
                    revenue=revenue,
                    returns=r_total,
                    net=net,
                    cost=net_cost,
                    profit=net - net_cost,
                )
            )
            for key, val in (
                ("count", count),
                ("revenue", revenue),
                ("returns", r_total),
                ("cost", net_cost),
                ("discounts", discounts),
                ("cash", cash),
                ("credit", credit),
                ("wallet", wallet),
            ):
                tot[key] += val
        net = tot["revenue"] - tot["returns"]
        profit = net - tot["cost"]
        expenses = self.repo.expenses_total(q.date_from, q.date_to)
        promo_d, lines_d, invoice_d, loyalty_d = self.repo.discount_breakdown(q.date_from, q.date_to)
        sales_tax, returns_tax, untaxed = self.repo.tax_totals(q.date_from, q.date_to)
        return SalesReportOut(
            tax_total=sales_tax,
            tax_returns=returns_tax,
            tax_net=sales_tax - returns_tax,
            untaxed_count=untaxed,
            promo_discount=promo_d,
            lines_discount=lines_d,
            invoice_discount=invoice_d,
            loyalty_discount=loyalty_d,
            days=days,
            count=tot["count"],
            revenue=tot["revenue"],
            returns=tot["returns"],
            net=net,
            cost=tot["cost"],
            profit=profit,
            discounts=tot["discounts"],
            cash=tot["cash"],
            credit=tot["credit"],
            wallet=tot["wallet"],
            electronic=self._electronic(q.date_from, q.date_to),
            expenses=expenses,
            net_profit=profit - expenses,
        )

    # ================= الأصناف =================
    def products(self, q: ProductsQuery) -> ProductsReportOut:
        stats = self.repo.product_sales(q.date_from, q.date_to)
        categories = self._categories(stats)

        def in_category(p: Product) -> bool:
            if q.category_id is None:
                return True
            if q.category_id == NO_CATEGORY:
                return not p.category_id
            return p.category_id == q.category_id

        if q.rank is ProductRank.BOTTOM:
            # الأقل مبيعاً يشمل الأصناف النشطة التي لم تُبع إطلاقاً في الفترة.
            items = [p for p in self.repo.products(only_active=True) if in_category(p)]
            rows = [self._row(p, stats.get(p.id, [0, 0, 0])) for p in items]
            rows.sort(key=lambda r: (r.qty, r.revenue, r.name))
        else:
            items = [p for p in self.repo.products(set(stats)) if in_category(p)]
            rows = [self._row(p, stats[p.id]) for p in items]
            key = {
                ProductRank.TOP: lambda r: (-r.qty, -r.revenue),
                ProductRank.PROFIT: lambda r: (-r.profit, -r.qty),
                ProductRank.REVENUE: lambda r: (-r.revenue, -r.qty),
            }[q.rank]
            rows = [r for r in rows if r.qty > 0 or r.revenue > 0]
            rows.sort(key=key)
        return ProductsReportOut(items=rows[: q.limit], categories=categories)

    def _categories(self, stats: dict[str, list[int]]) -> list[CategorySalesOut]:
        """كل الأقسام (حتى بدون مبيعات) بإيرادها وربحها وكميتها في الفترة، الأعلى إيراداً أولاً."""
        agg: dict[str, CategorySalesOut] = {
            cid: CategorySalesOut(id=cid, name=name, revenue=0, profit=0, qty=0, products=0)
            for cid, name in self.repo.all_categories()
        }
        for pid, (cid, cname) in self.repo.category_names(set(stats)).items():
            key = cid or NO_CATEGORY
            row = agg.setdefault(
                key, CategorySalesOut(id=key, name=cname, revenue=0, profit=0, qty=0, products=0)
            )
            qty, revenue, cost = stats[pid]
            row.qty += qty
            row.revenue += revenue
            row.profit += revenue - cost
            row.products += 1
        return sorted(agg.values(), key=lambda c: (-c.revenue, c.name))

    @staticmethod
    def _row(p: Product, s: list[int]) -> ProductRowOut:
        qty, revenue, cost = s
        return ProductRowOut(
            product_id=p.id,
            name=p.name,
            unit=p.unit,
            qty=qty,
            revenue=revenue,
            cost=cost,
            profit=revenue - cost,
            stock_qty=p.stock_qty,
        )

    # ================= المخزون: النواقص والراكد =================
    def stock(self, q: StockQuery) -> StockReportOut:
        low, out = self.repo.low_and_out(q.limit)
        cutoff = datetime.combine(
            local_today() - timedelta(days=q.stagnant_days), time.min
        ).astimezone(timezone.utc)
        candidates = self.repo.stocked_before(cutoff)
        last = self.repo.last_sold({p.id for p in candidates})
        stagnant = [
            p
            for p in candidates
            if (at := last.get(p.id)) is None or _aware(at) < cutoff
        ]
        stagnant.sort(key=lambda p: -(p.stock_qty * p.cost_price))
        stagnant_rows = [self._stock_row(p, last.get(p.id)) for p in stagnant]
        all_last = self.repo.last_sold({p.id for p in low + out})
        return StockReportOut(
            stock_value=self.repo.stock_value(),
            low=[self._stock_row(p, all_last.get(p.id)) for p in low],
            out=[self._stock_row(p, all_last.get(p.id)) for p in out],
            stagnant=stagnant_rows[: q.limit],
            stagnant_value=sum(r.stock_value for r in stagnant_rows),
        )

    @staticmethod
    def _stock_row(p: Product, last_sold: datetime | None) -> StockRowOut:
        return StockRowOut(
            product_id=p.id,
            name=p.name,
            unit=p.unit,
            stock_qty=p.stock_qty,
            min_stock=p.min_stock,
            cost_price=p.cost_price,
            stock_value=max(p.stock_qty, 0) * p.cost_price // 1000,
            last_sold_at=last_sold,
        )

    # ================= المديونيات =================
    def debts(self) -> DebtsReportOut:
        now = utcnow()
        customers = [
            DebtorOut(
                id=c.id,
                name=c.name,
                phone=c.phone,
                balance=c.balance,
                credit_limit=c.credit_limit,
                last_payment_at=c.last_payment_at,
                is_overdue=is_overdue(c.balance, c.last_payment_at, c.created_at, now),
            )
            for c in self.repo.debtors()
        ]
        # المتأخر أولاً ثم الأكبر ديناً.
        customers.sort(key=lambda c: (not c.is_overdue, -c.balance))
        suppliers = [
            PayableOut(id=s.id, name=s.name, phone=s.phone, balance=s.balance)
            for s in self.repo.payables()
        ]
        overdue = [c for c in customers if c.is_overdue]
        return DebtsReportOut(
            customers_total=sum(c.balance for c in customers),
            overdue_total=sum(c.balance for c in overdue),
            overdue_count=len(overdue),
            customers=customers,
            suppliers_total=sum(s.balance for s in suppliers),
            suppliers=suppliers,
        )

    # ================= الخزنة =================
    def treasury(self, q: RangeQuery) -> TreasuryReportOut:
        opening = self.repo.cash_balance_before(q.date_from)
        kinds = self.repo.cash_by_kind(q.date_from, q.date_to)
        total_in = sum(t for _, d, _, t in kinds if d == "in")
        total_out = sum(t for _, d, _, t in kinds if d == "out")
        return TreasuryReportOut(
            opening=opening,
            total_in=total_in,
            total_out=total_out,
            closing=opening + total_in - total_out,
            by_kind=[TreasuryKindOut(kind=k, direction=d, count=c, total=t) for k, d, c, t in kinds],
        )

    # ================= لوحة التحكم =================
    def overview(self, q: RangeQuery) -> OverviewOut:
        """كل ما يحتاجه المدير عن فترة، مع نفس المؤشرات للفترة السابقة بنفس الطول للمقارنة."""
        days = (q.date_to - q.date_from).days + 1
        prev_to = q.date_from - timedelta(days=1)
        prev_from = prev_to - timedelta(days=days - 1)

        cur = self.sales(q)
        prev = self.sales(RangeQuery(date_from=prev_from, date_to=prev_to))
        stats = self.repo.product_sales(q.date_from, q.date_to)
        prev_stats = self.repo.product_sales(prev_from, prev_to)

        trend = [
            TrendPointOut(
                day=d.day,
                net=d.net,
                profit=d.profit,
                invoices=d.count,
                prev_net=prev.days[i].net if i < len(prev.days) else 0,
                prev_profit=prev.days[i].profit if i < len(prev.days) else 0,
            )
            for i, d in enumerate(cur.days)
        ]

        # ---- أوقات الذروة (يوم × ساعة) بتوقيت الجهاز ----
        grid: dict[tuple[int, int], list[int]] = {}
        for at, total in self.repo.sale_moments(q.date_from, q.date_to):
            local = _aware(at).astimezone()
            cell = grid.setdefault((_SAT_FIRST[local.weekday()], local.hour), [0, 0])
            cell[0] += 1
            cell[1] += total
        heatmap = [
            HeatCellOut(weekday=w, hour=h, invoices=v[0], net=v[1])
            for (w, h), v in sorted(grid.items())
        ]

        # ---- الأصناف والأقسام ----
        products = {p.id: p for p in self.repo.products(set(stats))}
        top = sorted(
            (pid for pid in stats if pid in products),
            key=lambda pid: -(stats[pid][1] - stats[pid][2]),
        )[:TOP_PRODUCTS]
        top_products = [
            NamedValueOut(
                key=pid,
                label=products[pid].name,
                value=stats[pid][1] - stats[pid][2],
                extra=stats[pid][1],
            )
            for pid in top
        ]
        cats: dict[str, list] = {}
        for pid, (cid, cname) in self.repo.category_names(set(stats)).items():
            agg = cats.setdefault(cid, [cname, 0, 0])
            agg[1] += stats[pid][1]
            agg[2] += stats[pid][1] - stats[pid][2]
        categories = [
            NamedValueOut(key=cid or "none", label=v[0], value=v[1], extra=v[2])
            for cid, v in sorted(cats.items(), key=lambda kv: -kv[1][1])
            if v[1] > 0
        ][:TOP_CATEGORIES]

        # ---- المصروفات والخزنة ----
        expenses = [
            NamedValueOut(key=c, label=CATEGORY_LABELS.get(c, c), value=t, extra=n)
            for c, t, n in self.repo.expenses_by_category(q.date_from, q.date_to)
        ]
        cash = self.repo.cash_by_day(q.date_from, q.date_to)
        cash_flow = [
            CashDayOut(day=d, cash_in=cash.get(d, (0, 0))[0], cash_out=cash.get(d, (0, 0))[1])
            for d in iter_days(q.date_from, q.date_to)
        ]

        # ---- أداء الكاشيرية ----
        sales_by_user = self.repo.cashier_sales(q.date_from, q.date_to)
        returns_by_user = self.repo.cashier_returns(q.date_from, q.date_to)
        names = user_names(self.session, [u for u, *_ in sales_by_user])
        cashiers = sorted(
            (
                CashierOut(
                    user_id=u,
                    name=names.get(u, "—"),
                    invoices=n,
                    net=total - returns_by_user.get(u, 0),
                    returns=returns_by_user.get(u, 0),
                    avg_ticket=total // n if n else 0,
                    discounts=disc,
                )
                for u, n, total, disc in sales_by_user
            ),
            key=lambda c: -c.net,
        )

        # ---- صحة النشاط الآن ----
        low, out = self.repo.count_low_out()
        stock = self.stock(StockQuery(stagnant_days=STAGNANT_DAYS, limit=500))
        debts = self.debts()
        shift_out = ShiftService(self.session, self.actor).current()
        labels = {k: m.name for k, m in SettingsService(self.session).payment_methods().items()}

        return OverviewOut(
            return_reasons=[
                NamedValueOut(key=r, label=r, value=t, extra=n)
                for r, t, n in self.repo.return_reasons(q.date_from, q.date_to)
            ],
            promotions=self._promotions(q, prev_from, prev_to),
            loyalty=self._loyalty(q) if has_feature(Feature.LOYALTY) else None,
            customers=self._customers(q) if has_feature(Feature.CUSTOMERS) else None,
            purchasing=(
                self._purchasing(q, prev_from, prev_to) if has_feature(Feature.SUPPLIERS) else None
            ),
            expiry=self._expiry() if has_feature(Feature.EXPIRY) else None,
            date_from=q.date_from,
            date_to=q.date_to,
            prev_from=prev_from,
            prev_to=prev_to,
            kpis=self._kpis(cur, stats),
            prev=self._kpis(prev, prev_stats),
            trend=trend,
            heatmap=heatmap,
            payments=[
                NamedValueOut(key="cash", label="كاش", value=cur.cash),
                NamedValueOut(key="credit", label="آجل", value=cur.credit),
                *cur.electronic,
            ],
            top_products=top_products,
            categories=categories,
            expenses_by_category=expenses,
            cash_flow=cash_flow,
            cashiers=cashiers,
            health=HealthOut(
                stock_value=stock.stock_value,
                low_stock=low,
                out_of_stock=out,
                stagnant_count=len(stock.stagnant),
                stagnant_value=stock.stagnant_value,
                customers_debt=debts.customers_total,
                overdue_customers=debts.overdue_count,
                overdue_debt=debts.overdue_total,
                suppliers_payable=debts.suppliers_total,
                treasury_balance=self.repo.cash_balance_before(local_today() + timedelta(days=1)),
            ),
            shift=ShiftBriefOut(
                cashier_name=shift_out.cashier_name,
                opened_at=shift_out.opened_at,
                sales_count=shift_out.sales_count,
                expected_cash=shift_out.expected_cash or 0,
            )
            if shift_out
            else None,
            recent_sales=[
                RecentSaleOut(
                    id=s.id,
                    number=s.number,
                    sold_at=s.created_at,
                    customer_name=s.customer_name,
                    payment_method=s.payment_method,
                    payment_label=method_label(s.payment_method, s.payment_label, labels),
                    total=s.total,
                )
                for s in self.repo.recent_sales(RECENT_SALES)
            ],
        )

    # ---------- أقسام اللوحة حسب الخطة ----------
    def _promotions(self, q: RangeQuery, prev_from: date, prev_to: date) -> PromotionsBriefOut:
        from app.modules.promotions.service import PromotionService  # متأخر: لا دوران

        status = PromotionService(self.session, self.actor).summary()
        discount, invoices = self.repo.promo_totals(q.date_from, q.date_to)
        prev_discount, _ = self.repo.promo_totals(prev_from, prev_to)
        return PromotionsBriefOut(
            active=status.active,
            scheduled=status.scheduled,
            discount=discount,
            prev_discount=prev_discount,
            invoices=invoices,
            top=[
                NamedValueOut(key=name, label=name, value=total, extra=lines)
                for name, total, lines in self.repo.top_promos(q.date_from, q.date_to, TOP_PROMOS)
            ],
        )

    def _loyalty(self, q: RangeQuery) -> LoyaltyBriefOut:
        cfg = SettingsService(self.session).loyalty()
        earned, redeemed, value = self.repo.loyalty_period(q.date_from, q.date_to)
        points, owed, members = self.repo.loyalty_outstanding(cfg.redeem_points, cfg.redeem_value)
        return LoyaltyBriefOut(
            enabled=cfg.enabled,
            earned=earned,
            redeemed=redeemed,
            redeem_value=value,
            outstanding_points=points,
            outstanding_value=owed,
            members=members,
        )

    def _customers(self, q: RangeQuery) -> CustomersBriefOut:
        start, end = day_bounds_utc(q.date_from, q.date_to)
        return CustomersBriefOut(
            new_customers=self.repo.new_customers(start, end),
            active_customers=self.repo.active_customers(q.date_from, q.date_to),
            top=[
                NamedValueOut(key=cid, label=name, value=total, extra=count)
                for cid, name, total, count in self.repo.top_customers(
                    q.date_from, q.date_to, TOP_CUSTOMERS
                )
            ],
        )

    def _purchasing(self, q: RangeQuery, prev_from: date, prev_to: date) -> PurchasingBriefOut:
        from app.modules.purchase_orders.service import PurchaseOrderService  # متأخر: لا دوران

        total, count = self.repo.purchases_totals(q.date_from, q.date_to)
        prev_total, _ = self.repo.purchases_totals(prev_from, prev_to)
        orders = PurchaseOrderService(self.session, self.actor).summary()
        return PurchasingBriefOut(
            purchases_total=total,
            prev_purchases_total=prev_total,
            purchases_count=count,
            draft_orders=orders.draft,
            sent_orders=orders.sent,
            open_orders_total=orders.open_total,
            received_month=orders.received_month,
        )

    def _expiry(self) -> ExpiryBriefOut:
        from app.modules.batches.routes import summary as expiry_summary  # متأخر: لا دوران

        return ExpiryBriefOut(**expiry_summary(self.session).model_dump())

    def _electronic(self, d1, d2) -> list[NamedValueOut]:
        """الطرق المفعّلة في الإعدادات (حتى لو صفر) ثم أي طريقة أخرى استُخدمت في الفترة."""
        configured = SettingsService(self.session).payment_methods()
        used = {m: (label, total) for m, label, total in self.repo.electronic_by_method(d1, d2)}
        out = [
            NamedValueOut(key=k, label=m.name, value=used.get(k, (None, 0))[1])
            for k, m in configured.items()
            if m.enabled or k in used
        ]
        out += [
            NamedValueOut(key=k, label=method_label(k, label), value=total)
            for k, (label, total) in sorted(used.items(), key=lambda kv: -kv[1][1])
            if k not in configured
        ]
        return out

    @staticmethod
    def _kpis(r: SalesReportOut, stats: dict[str, list[int]]) -> KpisOut:
        return KpisOut(
            net_sales=r.net,
            gross_profit=r.profit,
            expenses=r.expenses,
            net_profit=r.net_profit,
            invoices=r.count,
            avg_ticket=r.revenue // r.count if r.count else 0,
            items_sold=sum(v[0] for v in stats.values()),
            returns=r.returns,
            discounts=r.discounts,
            cash_sales=r.cash,
            credit_sales=r.credit,
            wallet_sales=r.wallet,
        )


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

