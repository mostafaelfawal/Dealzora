"""الوصول لقاعدة البيانات فقط. لا commit هنا."""

from collections.abc import Iterable
from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.modules.users.model import User

from .model import CashEntry
from .types import CashDirection, CashFilters, CashSortKey, TreasurySummary

_ORDER = {
    CashSortKey.NEWEST: (CashEntry.occurred_at.desc(), CashEntry.id.desc()),
    CashSortKey.OLDEST: (CashEntry.occurred_at.asc(), CashEntry.id.asc()),
    CashSortKey.AMOUNT_DESC: (CashEntry.amount.desc(), CashEntry.id.desc()),
    CashSortKey.AMOUNT_ASC: (CashEntry.amount.asc(), CashEntry.id.asc()),
}


class CashRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, entry_id: str) -> CashEntry | None:
        stmt = select(CashEntry).where(CashEntry.id == entry_id, CashEntry.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def get_by_source(self, source_entity: str, source_id: str) -> CashEntry | None:
        stmt = select(CashEntry).where(
            CashEntry.source_entity == source_entity,
            CashEntry.source_id == source_id,
            CashEntry.deleted_at.is_(None),
        )
        return self.session.scalars(stmt).first()

    @staticmethod
    def _conditions(f: CashFilters) -> list:
        conds = [CashEntry.deleted_at.is_(None)]
        if f.direction:
            conds.append(CashEntry.direction == f.direction.value)
        if f.kind:
            conds.append(CashEntry.kind == f.kind.value)
        if f.date_from:
            conds.append(CashEntry.occurred_at >= f.date_from)
        if f.date_to:
            conds.append(CashEntry.occurred_at <= f.date_to)
        return conds

    def list_entries(self, f: CashFilters) -> tuple[list[CashEntry], int]:
        conds = self._conditions(f)
        total = self.session.scalar(select(func.count()).select_from(CashEntry).where(*conds)) or 0
        stmt = (
            select(CashEntry)
            .where(*conds)
            .order_by(*_ORDER[f.sort])
            .offset((f.page - 1) * f.page_size)
            .limit(f.page_size)
        )
        return list(self.session.scalars(stmt).all()), total

    def summary(self, today: date) -> TreasurySummary:
        month_start = today.replace(day=1)

        def _sum(direction: CashDirection, cond=None):
            c = CashEntry.direction == direction.value
            if cond is not None:
                c = and_(c, cond)
            return func.coalesce(func.sum(case((c, CashEntry.amount), else_=0)), 0)

        day = CashEntry.occurred_at == today
        month = and_(CashEntry.occurred_at >= month_start, CashEntry.occurred_at <= today)
        stmt = select(
            _sum(CashDirection.IN),
            _sum(CashDirection.OUT),
            _sum(CashDirection.IN, day),
            _sum(CashDirection.OUT, day),
            _sum(CashDirection.IN, month),
            _sum(CashDirection.OUT, month),
        ).where(CashEntry.deleted_at.is_(None))
        t_in, t_out, d_in, d_out, m_in, m_out = self.session.execute(stmt).one()
        return TreasurySummary(
            balance=t_in - t_out,
            total_in=t_in,
            total_out=t_out,
            today_in=d_in,
            today_out=d_out,
            month_in=m_in,
            month_out=m_out,
        )

    def user_names(self, user_ids: Iterable[str]) -> dict[str, str]:
        ids = set(user_ids)
        if not ids:
            return {}
        rows = self.session.execute(select(User.id, User.username).where(User.id.in_(ids))).all()
        return {uid: username for uid, username in rows}

    def add(self, entry: CashEntry) -> None:
        self.session.add(entry)

    def flush(self) -> None:
        self.session.flush()