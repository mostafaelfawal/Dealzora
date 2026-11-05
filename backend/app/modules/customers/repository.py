"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from datetime import datetime

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from .helper import escape_like, normalize_search
from .model import Customer, CustomerLedgerEntry
from .types import CustomerFilter, CustomerFilters, CustomerSort, CustomersSummary

_DEBTOR = Customer.balance > 0
_AT_LIMIT = and_(_DEBTOR, Customer.credit_limit > 0, Customer.balance >= Customer.credit_limit)


def _overdue(before: datetime):
    last_activity = func.coalesce(Customer.last_payment_at, Customer.created_at)
    return and_(_DEBTOR, last_activity < before)


_ORDER = {
    CustomerSort.DEBT: (Customer.balance.desc(), Customer.name.asc()),
    CustomerSort.NAME: (Customer.name.asc(),),
    CustomerSort.RECENT: (Customer.last_purchase_at.desc().nulls_last(), Customer.name.asc()),
    CustomerSort.SALES: (Customer.total_sales.desc(), Customer.name.asc()),
    CustomerSort.NEWEST: (Customer.id.desc(),),  # UUIDv7 مرتب زمنياً
}


class CustomerRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- قراءة ----------
    def get(self, customer_id: str) -> Customer | None:
        stmt = select(Customer).where(Customer.id == customer_id, Customer.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def phone_taken(self, phone: str, *, exclude_customer_id: str | None = None) -> bool:
        stmt = select(Customer.id).where(Customer.phone == phone, Customer.deleted_at.is_(None))
        if exclude_customer_id:
            stmt = stmt.where(Customer.id != exclude_customer_id)
        return self.session.scalar(stmt.limit(1)) is not None

    @staticmethod
    def _conditions(filters: CustomerFilters) -> list:
        conds = [Customer.deleted_at.is_(None)]
        if filters.only_active:
            conds.append(Customer.is_active.is_(True))
        if term := normalize_search(filters.query):
            conds.append(Customer.search_text.like(f"%{escape_like(term)}%", escape="\\"))
        match filters.filter:
            case CustomerFilter.DEBTORS:
                conds.append(_DEBTOR)
            case CustomerFilter.OVERDUE:
                conds.append(_overdue(filters.overdue_before))
            case CustomerFilter.LIMIT:
                conds.append(_AT_LIMIT)
            case CustomerFilter.INACTIVE:
                conds.append(Customer.is_active.is_(False))
        return conds

    def list_customers(self, filters: CustomerFilters) -> tuple[list[Customer], int]:
        conds = self._conditions(filters)
        total = self.session.scalar(select(func.count()).select_from(Customer).where(*conds)) or 0
        stmt = (
            select(Customer)
            .where(*conds)
            .order_by(*_ORDER[filters.sort], Customer.id)
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )
        return list(self.session.scalars(stmt).all()), total

    def summary(self, overdue_before: datetime) -> CustomersSummary:
        def count_if(cond):
            return func.coalesce(func.sum(case((cond, 1), else_=0)), 0)

        stmt = select(
            func.count(),
            func.coalesce(func.sum(case((_DEBTOR, Customer.balance), else_=0)), 0),
            count_if(_DEBTOR),
            count_if(_overdue(overdue_before)),
            count_if(_AT_LIMIT),
            count_if(Customer.is_active.is_(False)),
        ).where(Customer.deleted_at.is_(None))
        total, debt, debtors, overdue, at_limit, inactive = self.session.execute(stmt).one()
        return CustomersSummary(
            total=total,
            total_debt=debt,
            debtors=debtors,
            overdue=overdue,
            at_limit=at_limit,
            inactive=inactive,
        )

    def list_entries(
        self, customer_id: str, page: int, page_size: int
    ) -> tuple[list[CustomerLedgerEntry], int]:
        cond = CustomerLedgerEntry.customer_id == customer_id
        total = (
            self.session.scalar(select(func.count()).select_from(CustomerLedgerEntry).where(cond))
            or 0
        )
        stmt = (
            select(CustomerLedgerEntry)
            .where(cond)
            .order_by(CustomerLedgerEntry.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.session.scalars(stmt).all()), total

    # ---------- كتابة ----------
    def add(self, customer: Customer) -> None:
        self.session.add(customer)

    def add_entry(self, entry: CustomerLedgerEntry) -> None:
        self.session.add(entry)

    def flush(self) -> None:
        self.session.flush()
