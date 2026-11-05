"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from collections.abc import Iterable
from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.modules.users.model import User

from .helper import escape_like, normalize_search, period_starts
from .model import Expense
from .types import ExpenseFilters, ExpenseSortKey, ExpensesSummary

_ORDER = {
    ExpenseSortKey.NEWEST: (Expense.spent_at.desc(), Expense.id.desc()),
    ExpenseSortKey.OLDEST: (Expense.spent_at.asc(), Expense.id.asc()),
    ExpenseSortKey.AMOUNT_DESC: (Expense.amount.desc(), Expense.id.desc()),
    ExpenseSortKey.AMOUNT_ASC: (Expense.amount.asc(), Expense.id.asc()),
}


class ExpenseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- قراءة ----------
    def get(self, expense_id: str) -> Expense | None:
        stmt = select(Expense).where(Expense.id == expense_id, Expense.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    @staticmethod
    def _conditions(filters: ExpenseFilters) -> list:
        conds = [Expense.deleted_at.is_(None)]
        if filters.category:
            conds.append(Expense.category == filters.category.value)
        if filters.date_from:
            conds.append(Expense.spent_at >= filters.date_from)
        if filters.date_to:
            conds.append(Expense.spent_at <= filters.date_to)
        if term := normalize_search(filters.query):
            conds.append(Expense.search_text.like(f"%{escape_like(term)}%", escape="\\"))
        return conds

    def list_expenses(self, filters: ExpenseFilters) -> tuple[list[Expense], int]:
        conds = self._conditions(filters)
        total = self.session.scalar(select(func.count()).select_from(Expense).where(*conds)) or 0
        stmt = (
            select(Expense)
            .where(*conds)
            .order_by(*_ORDER[filters.sort])
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )
        return list(self.session.scalars(stmt).all()), total

    def summary(self, today: date) -> ExpensesSummary:
        week_start, month_start = period_starts(today)
        day = Expense.spent_at == today
        week = and_(Expense.spent_at >= week_start, Expense.spent_at <= today)
        month = and_(Expense.spent_at >= month_start, Expense.spent_at <= today)

        def _sum(cond):
            return func.coalesce(func.sum(case((cond, Expense.amount), else_=0)), 0)

        stmt = select(
            func.count(),
            func.coalesce(func.sum(Expense.amount), 0),
            _sum(day),
            _sum(week),
            _sum(month),
        ).where(Expense.deleted_at.is_(None))
        count, total, d, w, m = self.session.execute(stmt).one()
        return ExpensesSummary(today=d, week=w, month=m, total=total, count=count)

    def user_names(self, user_ids: Iterable[str]) -> dict[str, str]:
        """id → username (اسم الدخول، لأن جدول المستخدمين ما فيهوش اسم عرض)."""
        ids = set(user_ids)
        if not ids:
            return {}
        rows = self.session.execute(
            select(User.id, User.username).where(User.id.in_(ids))
        ).all()
        return {uid: username for uid, username in rows}

    # ---------- كتابة ----------
    def add(self, expense: Expense) -> None:
        self.session.add(expense)

    def flush(self) -> None:
        self.session.flush()