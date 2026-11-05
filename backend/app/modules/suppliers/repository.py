"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from sqlalchemy import func, select

from app.core.repository import BaseRepository, fetch_page, like_contains, live, sum_if

from .model import Supplier, SupplierTransaction
from .types import BalanceFilter, SortKey, SupplierFilters, SuppliersSummary

_ORDER = {
    SortKey.NAME_ASC: (Supplier.name.asc(),),
    SortKey.NEWEST: (Supplier.id.desc(),),  # UUIDv7 مرتب زمنياً
    SortKey.BALANCE_DESC: (Supplier.balance.desc(), Supplier.name.asc()),
    SortKey.BALANCE_ASC: (Supplier.balance.asc(), Supplier.name.asc()),
}


class SupplierRepository(BaseRepository[Supplier]):
    model = Supplier

    def name_taken(self, name: str, *, exclude_id: str | None = None) -> bool:
        stmt = select(Supplier.id).where(Supplier.name == name, live(Supplier))
        if exclude_id:
            stmt = stmt.where(Supplier.id != exclude_id)
        return self.session.scalar(stmt.limit(1)) is not None

    @staticmethod
    def _conditions(filters: SupplierFilters) -> list:
        conds = [live(Supplier)]
        if (search := like_contains(Supplier.search_text, filters.query)) is not None:
            conds.append(search)
        if filters.balance is BalanceFilter.OWED:
            conds.append(Supplier.balance > 0)
        elif filters.balance is BalanceFilter.SETTLED:
            conds.append(Supplier.balance <= 0)
        return conds

    def list_suppliers(self, filters: SupplierFilters) -> tuple[list[Supplier], int]:
        return fetch_page(
            self.session,
            Supplier,
            self._conditions(filters),
            (*_ORDER[filters.sort], Supplier.id),
            filters.page,
            filters.page_size,
        )

    def summary(self) -> SuppliersSummary:
        stmt = select(
            func.count(),
            sum_if(Supplier.balance > 0),
            sum_if(Supplier.is_active.is_(False)),
            sum_if(Supplier.balance > 0, Supplier.balance),
        ).where(live(Supplier))
        total, owed, inactive, payable = self.session.execute(stmt).one()
        return SuppliersSummary(total=total, owed=owed, inactive=inactive, total_payable=payable)

    def list_transactions(
        self, supplier_id: str, page: int, page_size: int
    ) -> tuple[list[SupplierTransaction], int]:
        return fetch_page(
            self.session,
            SupplierTransaction,
            [SupplierTransaction.supplier_id == supplier_id],
            [SupplierTransaction.id.desc()],
            page,
            page_size,
        )

    def add_transaction(self, txn: SupplierTransaction) -> None:
        self.session.add(txn)