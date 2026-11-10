"""الوصول لقاعدة البيانات فقط. لا commit هنا."""

from datetime import date

from sqlalchemy import func, select

from app.core.repository import BaseRepository, fetch_page, like_contains, live
from app.modules.suppliers.model import Supplier

from .model import Purchase, PurchaseReturn
from .types import PurchaseFilters, PurchaseStatusFilter


class PurchaseRepository(BaseRepository[Purchase]):
    model = Purchase

    def next_number(self) -> int:
        return (self.session.scalar(select(func.max(Purchase.number))) or 0) + 1

    def next_return_number(self) -> int:
        return (self.session.scalar(select(func.max(PurchaseReturn.number))) or 0) + 1

    @staticmethod
    def _conditions(f: PurchaseFilters) -> list:
        conds = [live(Purchase)]
        if f.number is not None:
            conds.append(Purchase.number == f.number)
        elif (cond := like_contains(Supplier.search_text, f.query)) is not None:
            conds.append(Purchase.supplier_id.in_(select(Supplier.id).where(cond)))
        if f.supplier_id:
            conds.append(Purchase.supplier_id == f.supplier_id)
        if f.status is PurchaseStatusFilter.CREDIT:
            conds.append(Purchase.credit_amount > 0)
        elif f.status is PurchaseStatusFilter.RETURNED:
            conds.append(Purchase.returned_total > 0)
        if f.date_from:
            conds.append(Purchase.purchased_on >= f.date_from)
        if f.date_to:
            conds.append(Purchase.purchased_on <= f.date_to)
        return conds

    def list_purchases(self, f: PurchaseFilters) -> tuple[list[Purchase], int]:
        return fetch_page(
            self.session,
            Purchase,
            self._conditions(f),
            [Purchase.purchased_on.desc(), Purchase.number.desc()],
            f.page,
            f.page_size,
        )

    def period(self, day_from: date, day_to: date) -> tuple[int, int, int, int]:
        count, total, paid = self.session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Purchase.total), 0),
                func.coalesce(func.sum(Purchase.paid_amount), 0),
            ).where(live(Purchase), Purchase.purchased_on.between(day_from, day_to))
        ).one()
        returns = self.session.scalar(
            select(func.coalesce(func.sum(PurchaseReturn.total), 0)).where(
                live(PurchaseReturn), PurchaseReturn.returned_on.between(day_from, day_to)
            )
        )
        return count, total, paid, returns or 0

    def add_any(self, row: object) -> None:
        self.session.add(row)
