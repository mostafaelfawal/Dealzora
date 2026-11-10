"""قواعد العمل. كل أمر كتابة = معاملة واحدة: المصروف + Audit + Outbox ثم commit واحد."""

from collections.abc import Callable
from datetime import date

from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.outbox import OutboxOp, enqueue_outbox
from app.core.security import Actor

from app.modules.treasury.service import TreasuryService
from app.modules.treasury.types import CashDirection, CashKind

from .constants import CATEGORY_LABELS, ENTITY_EXPENSE, ERROR_MESSAGES, ExpenseError
from .helper import build_search_text, diff_snapshots, expense_snapshot
from .model import Expense
from .repository import ExpenseRepository
from .schema import (
    BulkFailureOut,
    BulkIn,
    BulkItemIn,
    BulkResultOut,
    ExpenseBase,
    ExpenseCreate,
    ExpenseListOut,
    ExpenseListQuery,
    ExpenseOut,
    ExpensesSummaryOut,
    ExpenseUpdate,
)
from .types import ExpenseFilters


def _err(exc: type[AppError], code: ExpenseError, **details) -> AppError:
    return exc(code=code.value, message=ERROR_MESSAGES[code], details=details or None)


class ExpenseService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor
        self.repo = ExpenseRepository(session)

    # ================= قراءة =================
    def list_expenses(self, query: ExpenseListQuery) -> ExpenseListOut:
        filters = ExpenseFilters(
            query=query.q,
            category=query.category,
            date_from=query.date_from,
            date_to=query.date_to,
            sort=query.sort,
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_expenses(filters)
        names = self._names(rows)
        return ExpenseListOut(
            items=[self._to_out(e, names) for e in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def summary(self) -> ExpensesSummaryOut:
        s = self.repo.summary(date.today())  # يوم الجهاز المحلي، مثل الواجهة
        return ExpensesSummaryOut(
            today=s.today, week=s.week, month=s.month, total=s.total, count=s.count
        )

    # ================= كتابة =================
    def create_expense(self, data: ExpenseCreate) -> ExpenseOut:
        expense = Expense(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
        )
        self._apply_fields(expense, data)
        self.repo.add(expense)
        self.repo.flush()

        self._audit(expense, "create", expense_snapshot(expense))
        self._enqueue(expense, base_version=None)
        self._sync_cash(expense)
        self.session.commit()
        return self._to_out(expense, self._names([expense]))

    def update_expense(self, expense_id: str, data: ExpenseUpdate) -> ExpenseOut:
        expense = self._get_or_404(expense_id)
        self._check_version(expense, data.base_version)

        before = expense_snapshot(expense)
        self._apply_fields(expense, data)
        expense.mark_modified()
        self.repo.flush()

        self._audit(expense, "update", diff_snapshots(before, expense_snapshot(expense)))
        self._enqueue(expense, base_version=data.base_version)
        self._sync_cash(expense)
        self.session.commit()
        return self._to_out(expense, self._names([expense]))

    def delete_expense(self, expense_id: str, base_version: int) -> None:
        expense = self._get_or_404(expense_id)
        self._check_version(expense, base_version)

        self._audit(expense, "delete", expense_snapshot(expense))
        expense.mark_deleted()  # tombstone: يبقى في الجدول ويُنشر للمزامنة
        self._enqueue(expense, base_version=base_version, op=OutboxOp.DELETE)
        TreasuryService(self.session, self.actor).void_source_entry(
            source_entity=ENTITY_EXPENSE, source_id=expense.id
        )
        self.session.commit()

    # ================= عمليات جماعية =================
    def bulk_delete(self, data: BulkIn) -> BulkResultOut:
        return self._run_bulk(
            data, lambda item: self.delete_expense(item.id, item.base_version)
        )

    def _run_bulk(
        self, data: BulkIn, action: Callable[[BulkItemIn], None]
    ) -> BulkResultOut:
        """ينفّذ action لكل عنصر في معاملة مستقلة، وفشل عنصر لا يوقف الباقي."""
        succeeded: list[str] = []
        failed: list[BulkFailureOut] = []
        seen: set[str] = set()
        for item in data.items:
            if item.id in seen:
                continue
            seen.add(item.id)
            try:
                action(item)
                succeeded.append(item.id)
            except AppError as exc:
                self.session.rollback()
                failed.append(BulkFailureOut(id=item.id, code=exc.code, message=exc.message))
        return BulkResultOut(succeeded=succeeded, failed=failed)

    # ================= داخلي =================
    def _get_or_404(self, expense_id: str) -> Expense:
        expense = self.repo.get(expense_id)
        if expense is None:
            raise _err(NotFoundError, ExpenseError.NOT_FOUND)
        return expense

    @staticmethod
    def _check_version(expense: Expense, base_version: int) -> None:
        if base_version != expense.version:
            raise _err(
                ConflictError,
                ExpenseError.VERSION_CONFLICT,
                current_version=expense.version,
            )

    @staticmethod
    def _apply_fields(expense: Expense, data: ExpenseBase) -> None:
        expense.category = data.category.value
        expense.amount = data.amount
        expense.spent_at = data.spent_at
        expense.note = data.note
        expense.search_text = build_search_text(data.note)

    def _sync_cash(self, expense: Expense) -> None:
        """كل مصروف = حركة خروج من الخزنة بنفس المبلغ والتاريخ (في نفس المعاملة)."""
        label = CATEGORY_LABELS.get(expense.category, "مصروف")
        TreasuryService(self.session, self.actor).upsert_source_entry(
            source_entity=ENTITY_EXPENSE,
            source_id=expense.id,
            direction=CashDirection.OUT,
            kind=CashKind.EXPENSE,
            amount=expense.amount,
            occurred_at=expense.spent_at,
            note=f"{label}: {expense.note}" if expense.note else label,
        )

    def _names(self, rows: list[Expense]) -> dict[str, str]:
        return self.repo.user_names(e.created_by for e in rows if e.created_by)

    def _audit(self, expense: Expense, action: str, changes: dict) -> None:
        record_audit(
            self.session,
            self.actor,
            entity=ENTITY_EXPENSE,
            entity_id=expense.id,
            action=action,
            changes=changes,
        )

    def _enqueue(
        self,
        expense: Expense,
        *,
        base_version: int | None,
        op: OutboxOp = OutboxOp.UPSERT,
    ) -> None:
        payload = {
            "id": expense.id,
            "version": expense.version,
            "deleted_at": expense.deleted_at.isoformat() if expense.deleted_at else None,
            **expense_snapshot(expense),
        }
        enqueue_outbox(
            self.session,
            entity=ENTITY_EXPENSE,
            entity_id=expense.id,
            op=op,
            payload=payload,
            base_version=base_version,
            device_id=self.actor.device_id,
        )

    @staticmethod
    def _to_out(e: Expense, names: dict[str, str]) -> ExpenseOut:
        return ExpenseOut(
            id=e.id,
            category=e.category,
            amount=e.amount,
            note=e.note,
            spent_at=e.spent_at,
            created_by_name=names.get(e.created_by) if e.created_by else None,
            version=e.version,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )