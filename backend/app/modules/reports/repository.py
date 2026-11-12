"""استعلامات تجميعية للتقارير (قراءة فقط). لا commit ولا قواعد عمل."""

from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.core.constants import QTY_SCALE
from app.core.repository import live
from app.modules.customers.model import Customer
from app.modules.expenses.model import Expense
from app.modules.products.model import Category, Product, StockMovement
from app.modules.products.types import MovementType
from app.modules.sales.model import Sale, SaleLine, SaleReturn, SaleReturnLine
from app.modules.suppliers.model import Supplier
from app.modules.treasury.model import CashEntry

_BASE_QTY = SaleLine.qty * SaleLine.factor / QTY_SCALE


class ReportRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- المبيعات ----------
    def sales_by_day(self, d1: date, d2: date) -> dict[date, tuple[int, ...]]:
        """يوم → (عدد، إجمالي، تكلفة، خصومات، كاش، آجل، إلكتروني)."""
        rows = self.session.execute(
            select(
                Sale.sold_on,
                func.count(),
                func.sum(Sale.total),
                func.sum(Sale.cost_total),
                func.sum(Sale.lines_discount + Sale.promo_discount + Sale.invoice_discount),
                func.sum(Sale.cash_amount),
                func.sum(Sale.credit_amount),
                func.sum(Sale.wallet_amount),
            )
            .where(live(Sale), Sale.sold_on.between(d1, d2))
            .group_by(Sale.sold_on)
        ).all()
        return {r[0]: tuple(int(v or 0) for v in r[1:]) for r in rows}  # type: ignore[misc]

    def electronic_by_method(self, d1: date, d2: date) -> list[tuple[str, str | None, int]]:
        """(معرّف الطريقة، آخر اسم مسجّل، المبلغ) للدفع الإلكتروني في الفترة."""
        rows = self.session.execute(
            select(Sale.payment_method, func.max(Sale.payment_label), func.sum(Sale.wallet_amount))
            .where(live(Sale), Sale.sold_on.between(d1, d2), Sale.wallet_amount > 0)
            .group_by(Sale.payment_method)
        ).all()
        return [(m, label, int(total or 0)) for m, label, total in rows]

    def returns_by_day(self, d1: date, d2: date) -> dict[date, tuple[int, int]]:
        """يوم → (قيمة المرتجع، تكلفته)."""
        rows = self.session.execute(
            select(SaleReturn.returned_on, func.sum(SaleReturn.total), func.sum(SaleReturn.cost_total))
            .where(live(SaleReturn), SaleReturn.returned_on.between(d1, d2))
            .group_by(SaleReturn.returned_on)
        ).all()
        return {r[0]: (int(r[1] or 0), int(r[2] or 0)) for r in rows}

    def expenses_total(self, d1: date, d2: date) -> int:
        return int(
            self.session.scalar(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(
                    live(Expense), Expense.spent_at.between(d1, d2)
                )
            )
            or 0
        )

    # ---------- الأصناف ----------
    def product_sales(self, d1: date, d2: date) -> dict[str, list[int]]:
        """صنف → [كمية أساسية، إيراد، تكلفة] بعد طرح المرتجع في نفس الفترة."""
        out: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
        sold = self.session.execute(
            select(
                SaleLine.product_id,
                func.sum(_BASE_QTY),
                func.sum(SaleLine.net_total),
                func.sum(SaleLine.cost_total),
            )
            .join(Sale, Sale.id == SaleLine.sale_id)
            .where(live(Sale), Sale.sold_on.between(d1, d2))
            .group_by(SaleLine.product_id)
        ).all()
        for pid, qty, revenue, cost in sold:
            out[pid][0] += int(qty or 0)
            out[pid][1] += int(revenue or 0)
            out[pid][2] += int(cost or 0)
        returned = self.session.execute(
            select(
                SaleReturnLine.product_id,
                func.sum(SaleReturnLine.qty * SaleLine.factor / QTY_SCALE),
                func.sum(SaleReturnLine.amount),
                func.sum(SaleReturnLine.cost_total),
            )
            .join(SaleReturn, SaleReturn.id == SaleReturnLine.return_id)
            .join(SaleLine, SaleLine.id == SaleReturnLine.sale_line_id)
            .where(live(SaleReturn), SaleReturn.returned_on.between(d1, d2))
            .group_by(SaleReturnLine.product_id)
        ).all()
        for pid, qty, amount, cost in returned:
            out[pid][0] -= int(qty or 0)
            out[pid][1] -= int(amount or 0)
            out[pid][2] -= int(cost or 0)
        return out

    def products(self, ids: set[str] | None = None, *, only_active: bool = False) -> list[Product]:
        stmt = select(Product).where(live(Product))
        if ids is not None:
            if not ids:
                return []
            stmt = stmt.where(Product.id.in_(ids))
        if only_active:
            stmt = stmt.where(Product.is_active.is_(True))
        return list(self.session.scalars(stmt.order_by(Product.name)).all())

    # ---------- المخزون ----------
    def stock_value(self) -> int:
        return int(
            self.session.scalar(
                select(
                    func.coalesce(
                        func.sum(
                            case(
                                (Product.stock_qty > 0, Product.stock_qty * Product.cost_price / QTY_SCALE),
                                else_=0,
                            )
                        ),
                        0,
                    )
                ).where(live(Product))
            )
            or 0
        )

    def low_and_out(self, limit: int) -> tuple[list[Product], list[Product]]:
        active = and_(live(Product), Product.is_active.is_(True))
        low = self.session.scalars(
            select(Product)
            .where(
                active,
                Product.stock_qty > 0,
                Product.min_stock > 0,
                Product.stock_qty <= Product.min_stock,
            )
            .order_by((Product.stock_qty * 1.0 / Product.min_stock).asc(), Product.name)
            .limit(limit)
        ).all()
        out = self.session.scalars(
            select(Product).where(active, Product.stock_qty <= 0).order_by(Product.name).limit(limit)
        ).all()
        return list(low), list(out)

    def last_sold(self, ids: set[str] | None = None) -> dict[str, datetime]:
        stmt = select(StockMovement.product_id, func.max(StockMovement.created_at)).where(
            StockMovement.movement_type == MovementType.SALE.value
        )
        if ids is not None:
            stmt = stmt.where(StockMovement.product_id.in_(ids))
        rows = self.session.execute(stmt.group_by(StockMovement.product_id)).all()
        return {pid: at for pid, at in rows}

    def stocked_before(self, cutoff: datetime) -> list[Product]:
        """أصناف لها رصيد وأُضيفت قبل بداية فترة الركود (الجديد ليس راكداً)."""
        return list(
            self.session.scalars(
                select(Product).where(
                    live(Product),
                    Product.is_active.is_(True),
                    Product.stock_qty > 0,
                    Product.created_at < cutoff,
                )
            ).all()
        )

    def count_low_out(self) -> tuple[int, int]:
        active = and_(live(Product), Product.is_active.is_(True))
        low = self.session.scalar(
            select(func.count()).where(
                active,
                Product.stock_qty > 0,
                Product.min_stock > 0,
                Product.stock_qty <= Product.min_stock,
            )
        )
        out = self.session.scalar(select(func.count()).where(active, Product.stock_qty <= 0))
        return int(low or 0), int(out or 0)

    # ---------- المديونيات ----------
    def debtors(self) -> list[Customer]:
        return list(
            self.session.scalars(
                select(Customer)
                .where(live(Customer), Customer.balance > 0)
                .order_by(Customer.balance.desc())
            ).all()
        )

    def payables(self) -> list[Supplier]:
        return list(
            self.session.scalars(
                select(Supplier)
                .where(live(Supplier), Supplier.balance > 0)
                .order_by(Supplier.balance.desc())
            ).all()
        )

    # ---------- الخزنة ----------
    def cash_balance_before(self, day: date) -> int:
        signed = case((CashEntry.direction == "in", CashEntry.amount), else_=-CashEntry.amount)
        return int(
            self.session.scalar(
                select(func.coalesce(func.sum(signed), 0)).where(
                    live(CashEntry), CashEntry.occurred_at < day
                )
            )
            or 0
        )

    def cash_by_kind(self, d1: date, d2: date) -> list[tuple[str, str, int, int]]:
        rows = self.session.execute(
            select(CashEntry.kind, CashEntry.direction, func.count(), func.sum(CashEntry.amount))
            .where(live(CashEntry), CashEntry.occurred_at.between(d1, d2))
            .group_by(CashEntry.kind, CashEntry.direction)
            .order_by(func.sum(CashEntry.amount).desc())
        ).all()
        return [(k, d, int(c), int(t or 0)) for k, d, c, t in rows]

    # ---------- لوحة التحكم ----------
    def sale_moments(self, d1: date, d2: date) -> list[tuple[datetime, int]]:
        """(وقت الفاتورة UTC، إجماليها) لخريطة أوقات الذروة."""
        rows = self.session.execute(
            select(Sale.created_at, Sale.total).where(live(Sale), Sale.sold_on.between(d1, d2))
        ).all()
        return [(at, int(total)) for at, total in rows]

    def category_names(self, product_ids: set[str]) -> dict[str, tuple[str, str]]:
        """صنف → (id القسم، اسمه). بدون قسم = ("", "بدون قسم")."""
        if not product_ids:
            return {}
        rows = self.session.execute(
            select(Product.id, Category.id, Category.name)
            .select_from(Product)
            .join(Category, Category.id == Product.category_id, isouter=True)
            .where(Product.id.in_(product_ids))
        ).all()
        return {pid: (cid or "", cname or "بدون قسم") for pid, cid, cname in rows}

    def expenses_by_category(self, d1: date, d2: date) -> list[tuple[str, int, int]]:
        rows = self.session.execute(
            select(Expense.category, func.sum(Expense.amount), func.count())
            .where(live(Expense), Expense.spent_at.between(d1, d2))
            .group_by(Expense.category)
            .order_by(func.sum(Expense.amount).desc())
        ).all()
        return [(c, int(t or 0), int(n)) for c, t, n in rows]

    def cash_by_day(self, d1: date, d2: date) -> dict[date, tuple[int, int]]:
        rows = self.session.execute(
            select(
                CashEntry.occurred_at,
                func.sum(case((CashEntry.direction == "in", CashEntry.amount), else_=0)),
                func.sum(case((CashEntry.direction == "out", CashEntry.amount), else_=0)),
            )
            .where(live(CashEntry), CashEntry.occurred_at.between(d1, d2))
            .group_by(CashEntry.occurred_at)
        ).all()
        return {d: (int(i or 0), int(o or 0)) for d, i, o in rows}

    def cashier_sales(self, d1: date, d2: date) -> list[tuple[str, int, int, int]]:
        """(المستخدم، عدد الفواتير، الإجمالي، الخصومات)."""
        rows = self.session.execute(
            select(
                Sale.created_by,
                func.count(),
                func.sum(Sale.total),
                func.sum(Sale.lines_discount + Sale.promo_discount + Sale.invoice_discount),
            )
            .where(live(Sale), Sale.sold_on.between(d1, d2))
            .group_by(Sale.created_by)
        ).all()
        return [(u or "", int(c), int(t or 0), int(dsc or 0)) for u, c, t, dsc in rows]

    def cashier_returns(self, d1: date, d2: date) -> dict[str, int]:
        rows = self.session.execute(
            select(SaleReturn.created_by, func.sum(SaleReturn.total))
            .where(live(SaleReturn), SaleReturn.returned_on.between(d1, d2))
            .group_by(SaleReturn.created_by)
        ).all()
        return {u or "": int(t or 0) for u, t in rows}

    def recent_sales(self, limit: int) -> list[Sale]:
        return list(
            self.session.scalars(
                select(Sale).where(live(Sale)).order_by(Sale.number.desc()).limit(limit)
            ).all()
        )
