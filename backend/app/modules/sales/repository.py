"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا."""

from datetime import date

from sqlalchemy import func, or_, select

from app.core.repository import BaseRepository, fetch_page, like_contains, live

from app.modules.customers.model import Customer

from .model import Sale, SaleLine, SaleReturn
from .types import PeriodTotals, SaleFilters, SaleSort, SaleStatusFilter

_ORDER = {
    SaleSort.NEWEST: (Sale.number.desc(),),
    SaleSort.OLDEST: (Sale.number.asc(),),
    SaleSort.TOTAL_DESC: (Sale.total.desc(), Sale.number.desc()),
    SaleSort.TOTAL_ASC: (Sale.total.asc(), Sale.number.desc()),
}


def _customer_match(query: str):
    """فواتير العملاء المطابقين للبحث (الاسم/الهاتف مُطبَّعين). None لو البحث فارغ."""
    cond = like_contains(Customer.search_text, query)
    return None if cond is None else Sale.customer_id.in_(select(Customer.id).where(cond))


class SaleRepository(BaseRepository[Sale]):
    model = Sale

    # ---------- أرقام متسلسلة (داخل معاملة الكتابة) ----------
    def next_number(self) -> int:
        return (self.session.scalar(select(func.max(Sale.number))) or 0) + 1

    def next_return_number(self) -> int:
        return (self.session.scalar(select(func.max(SaleReturn.number))) or 0) + 1

    # ---------- قراءة ----------
    def by_client_ref(self, client_ref: str) -> Sale | None:
        return self.session.scalars(select(Sale).where(Sale.client_ref == client_ref)).first()

    def by_number(self, number: int) -> Sale | None:
        return self.session.scalars(select(Sale).where(Sale.number == number, live(Sale))).first()

    def get_line(self, line_id: str) -> SaleLine | None:
        return self.session.scalars(
            select(SaleLine).where(SaleLine.id == line_id, live(SaleLine))
        ).first()

    def get_return(self, return_id: str) -> SaleReturn | None:
        return self.session.scalars(
            select(SaleReturn).where(SaleReturn.id == return_id, live(SaleReturn))
        ).first()

    @staticmethod
    def _conditions(f: SaleFilters) -> list:
        conds = [live(Sale)]
        if f.number is not None:
            conds.append(Sale.number == f.number)
        elif (cond := _customer_match(f.query)) is not None:
            conds.append(cond)
        if f.customer_id:
            conds.append(Sale.customer_id == f.customer_id)
        if f.shift_id:
            conds.append(Sale.shift_id == f.shift_id)
        if f.method:
            conds.append(Sale.payment_method == f.method.value)
        if f.status is SaleStatusFilter.CREDIT:
            conds.append(Sale.credit_amount > 0)
        elif f.status is SaleStatusFilter.WALLET:
            conds.append(Sale.wallet_amount > 0)
        elif f.status is SaleStatusFilter.RETURNED:
            conds.append(Sale.returned_total > 0)
        if f.date_from:
            conds.append(Sale.sold_on >= f.date_from)
        if f.date_to:
            conds.append(Sale.sold_on <= f.date_to)
        return conds

    def list_sales(self, f: SaleFilters) -> tuple[list[Sale], int]:
        return fetch_page(
            self.session, Sale, self._conditions(f), _ORDER[f.sort], f.page, f.page_size
        )

    def list_returns(
        self,
        *,
        sale_number: int | None,
        query: str,
        reason: str | None,
        date_from: date | None,
        date_to: date | None,
        page: int,
        page_size: int,
    ) -> tuple[list[SaleReturn], int]:
        conds = [live(SaleReturn)]
        if sale_number is not None:
            sale_ids = select(Sale.id).where(Sale.number == sale_number)
            conds.append(or_(SaleReturn.sale_id.in_(sale_ids), SaleReturn.number == sale_number))
        elif (cond := _customer_match(query)) is not None:
            conds.append(SaleReturn.sale_id.in_(select(Sale.id).where(cond)))
        if reason:
            conds.append(SaleReturn.reason == reason)
        if date_from:
            conds.append(SaleReturn.returned_on >= date_from)
        if date_to:
            conds.append(SaleReturn.returned_on <= date_to)
        return fetch_page(
            self.session, SaleReturn, conds, [SaleReturn.number.desc()], page, page_size
        )

    def sale_numbers(self, sale_ids: set[str]) -> dict[str, int]:
        if not sale_ids:
            return {}
        rows = self.session.execute(select(Sale.id, Sale.number).where(Sale.id.in_(sale_ids)))
        return {sid: num for sid, num in rows.all()}

    def wallet_refunded(self, sale_id: str) -> int:
        """ما رُدّ للمحفظة من مرتجعات سابقة لهذه الفاتورة."""
        return int(
            self.session.scalar(
                select(func.coalesce(func.sum(SaleReturn.wallet_refund), 0)).where(
                    SaleReturn.sale_id == sale_id, live(SaleReturn)
                )
            )
            or 0
        )

    def customer_names(self, sale_ids: set[str]) -> dict[str, str | None]:
        if not sale_ids:
            return {}
        rows = self.session.execute(select(Sale.id, Sale.customer_name).where(Sale.id.in_(sale_ids)))
        return {sid: name for sid, name in rows.all()}

    def period_totals(self, day_from: date, day_to: date) -> PeriodTotals:
        s = self.session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Sale.total), 0),
                func.coalesce(func.sum(Sale.total - Sale.cost_total), 0),
            ).where(live(Sale), Sale.sold_on >= day_from, Sale.sold_on <= day_to)
        ).one()
        r = self.session.execute(
            select(
                func.coalesce(func.sum(SaleReturn.total), 0),
                func.coalesce(func.sum(SaleReturn.total - SaleReturn.cost_total), 0),
            ).where(
                live(SaleReturn),
                SaleReturn.returned_on >= day_from,
                SaleReturn.returned_on <= day_to,
            )
        ).one()
        return PeriodTotals(count=s[0], total=s[1] - r[0], profit=s[2] - r[1], returns=r[0])

    # ---------- كتابة ----------
    def add_any(self, row: object) -> None:
        self.session.add(row)
