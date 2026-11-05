"""أدوات repository مشتركة. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import ColumnElement, case, func, select
from sqlalchemy.orm import Session

from .text import escape_like, normalize_search

M = TypeVar("M")


def live(model: Any) -> ColumnElement[bool]:
    """شرط السجلات غير المحذوفة (حذف ناعم)."""
    return model.deleted_at.is_(None)


def like_contains(column: Any, raw_term: str) -> ColumnElement[bool] | None:
    """شرط بحث 'يحتوي' على نص مُطبَّع. يرجع None لو النص فارغ (فلا يُضاف شرط)."""
    term = normalize_search(raw_term)
    return column.like(f"%{escape_like(term)}%", escape="\\") if term else None


def sum_if(cond: ColumnElement[bool], value: Any = 1):
    """SUM(CASE WHEN cond THEN value ELSE 0 END) بدون NULL. للعدّ استخدم القيمة الافتراضية."""
    return func.coalesce(func.sum(case((cond, value), else_=0)), 0)


def fetch_page(
    session: Session,
    model: Any,
    conds: Sequence[ColumnElement[bool]],
    order: Sequence[Any],
    page: int,
    page_size: int,
) -> tuple[list, int]:
    """(الصفوف، الإجمالي). أضف tie-breaker (مثل Model.id) في order لثبات الترتيب."""
    total = session.scalar(select(func.count()).select_from(model).where(*conds)) or 0
    stmt = (
        select(model)
        .where(*conds)
        .order_by(*order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(session.scalars(stmt).all()), total


class BaseRepository(Generic[M]):
    """get/add/flush المشتركة. الوارث يحدد model فقط ويضيف استعلاماته."""

    model: type[M]

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, row_id: str) -> M | None:
        stmt = select(self.model).where(
            self.model.id == row_id,  # type: ignore[attr-defined]
            live(self.model),
        )
        return self.session.scalars(stmt).first()

    def add(self, row: M) -> None:
        self.session.add(row)

    def flush(self) -> None:
        self.session.flush()