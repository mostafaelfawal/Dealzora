"""تجميع التقارير. قراءة فقط ولا تعرض إلا للمدير (التكلفة والأرباح)."""

from datetime import datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.base import utcnow
from app.core.lookups import user_names
from app.core.periods import iter_days, local_today
from app.modules.expenses.constants import CATEGORY_LABELS
from app.core.security import Actor
from app.modules.customers.helper import is_overdue
from app.modules.products.model import Product
from app.modules.shifts.service import ShiftService

from .repository import ReportRepository
from .schema import (
    CashDayOut,
    CashierOut,
    DebtorOut,
    DebtsReportOut,
    HealthOut,
    HeatCellOut,
    KpisOut,
    NamedValueOut,
    OverviewOut,
    PayableOut,
    ProductRank,
    ProductRowOut,
    ProductsQuery,
    ProductsReportOut,
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
            count=0, revenue=0, returns=0, cost=0, discounts=0, cash=0, credit=0, vodafone=0, instapay=0
        )
        for day in iter_days(q.date_from, q.date_to):
            count, revenue, cost, discounts, cash, credit, vodafone, instapay = sales.get(
                day, (0, 0, 0, 0, 0, 0, 0, 0)
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
                ("vodafone", vodafone),
                ("instapay", instapay),
            ):
                tot[key] += val
        net = tot["revenue"] - tot["returns"]
        profit = net - tot["cost"]
        expenses = self.repo.expenses_total(q.date_from, q.date_to)
        return SalesReportOut(
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
            vodafone_cash=tot["vodafone"],
            instapay=tot["instapay"],
            expenses=expenses,
            net_profit=profit - expenses,
        )

    # ================= الأصناف =================
    def products(self, q: ProductsQuery) -> ProductsReportOut:
        stats = self.repo.product_sales(q.date_from, q.date_to)
        if q.rank is ProductRank.BOTTOM:
            # الأقل مبيعاً يشمل الأصناف النشطة التي لم تُبع إطلاقاً في الفترة.
            items = self.repo.products(only_active=True)
            rows = [self._row(p, stats.get(p.id, [0, 0, 0])) for p in items]
            rows.sort(key=lambda r: (r.qty, r.revenue, r.name))
        else:
            items = self.repo.products(set(stats))
            rows = [self._row(p, stats[p.id]) for p in items]
            key = {
                ProductRank.TOP: lambda r: (-r.qty, -r.revenue),
                ProductRank.PROFIT: lambda r: (-r.profit, -r.qty),
                ProductRank.REVENUE: lambda r: (-r.revenue, -r.qty),
            }[q.rank]
            rows = [r for r in rows if r.qty > 0 or r.revenue > 0]
            rows.sort(key=key)
        return ProductsReportOut(items=rows[: q.limit])

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

        return OverviewOut(
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
                NamedValueOut(key="vodafone_cash", label="فودافون كاش", value=cur.vodafone_cash),
                NamedValueOut(key="instapay", label="إنستاباي", value=cur.instapay),
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
                    total=s.total,
                )
                for s in self.repo.recent_sales(RECENT_SALES)
            ],
        )

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
            wallet_sales=r.vodafone_cash + r.instapay,
        )


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

