"""أساس مشترك لخدمات الكيانات: Audit + Outbox + فحص النسخة + commit + عمليات جماعية + حذف ناعم.

الوارث يحدد خصائص الكلاس فقط:

    class ExpenseService(EntityService):
        entity = ENTITY_EXPENSE
        messages = ERROR_MESSAGES
        version_conflict_error = ExpenseError.VERSION_CONFLICT
        snapshot_fields = EXPENSE_SNAPSHOT_FIELDS
"""

from collections.abc import Callable, Mapping
from enum import StrEnum
from typing import Any, ClassVar

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .audit import record_audit
from .bulk import BulkIn, BulkItemIn, BulkResultOut, run_bulk
from .errors import AppError, ConflictError
from .outbox import OutboxOp, enqueue_outbox
from .security import Actor, Role
from .snapshots import take_snapshot


class EntityService:
    entity: ClassVar[str]
    messages: ClassVar[Mapping[StrEnum, str]]
    version_conflict_error: ClassVar[StrEnum]
    unique_conflict_error: ClassVar[StrEnum | None] = None  # خطأ سباق الفهرس الفريد عند commit
    snapshot_fields: ClassVar[tuple[str, ...]] = ()

    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    @property
    def is_manager(self) -> bool:
        return self.actor.is_management  # المدير أو المالك

    # ---------- أخطاء ----------
    def _err(self, exc: type[AppError], code: StrEnum, **details: Any) -> AppError:
        return exc(code=code.value, message=self.messages[code], details=details or None)

    def _check_version(self, row: Any, base_version: int) -> None:
        if base_version != row.version:
            raise self._err(
                ConflictError, self.version_conflict_error, current_version=row.version
            )

    # ---------- لقطات (يمكن override عند الحاجة، مثل المنتجات بوحداتها) ----------
    def _snapshot(self, row: Any) -> dict[str, Any]:
        return take_snapshot(row, self.snapshot_fields)

    def _outbox_snapshot(self, row: Any) -> dict[str, Any]:
        return self._snapshot(row)

    # ---------- Audit / Outbox ----------
    def _audit(self, row: Any, action: str, changes: dict | None = None) -> None:
        record_audit(
            self.session,
            self.actor,
            entity=self.entity,
            entity_id=row.id,
            action=action,
            changes=changes,
        )

    def _enqueue(
        self, row: Any, *, base_version: int | None, op: OutboxOp = OutboxOp.UPSERT
    ) -> None:
        payload = {
            "id": row.id,
            "version": row.version,
            "deleted_at": row.deleted_at.isoformat() if row.deleted_at else None,
            **self._outbox_snapshot(row),
        }
        enqueue_outbox(
            self.session,
            entity=self.entity,
            entity_id=row.id,
            op=op,
            payload=payload,
            base_version=base_version,
            device_id=self.actor.device_id,
        )

    def _enqueue_event(self, entity: str, entity_id: str, payload: dict[str, Any]) -> None:
        """حدث لكيان فرعي append-only (حركة مخزون، قيد حساب، حركة مورد...)."""
        enqueue_outbox(
            self.session,
            entity=entity,
            entity_id=entity_id,
            op=OutboxOp.UPSERT,
            payload=payload,
            device_id=self.actor.device_id,
        )

    # ---------- commit ----------
    def _commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            if self.unique_conflict_error is None:
                raise
            raise self._err(ConflictError, self.unique_conflict_error) from exc

    # ---------- عمليات شائعة ----------
    def _set_active(self, row: Any, active: bool, base_version: int) -> None:
        self._check_version(row, base_version)
        was_active = row.is_active
        row.is_active = active
        row.mark_modified()
        self._audit(row, "toggle_active", {"is_active": {"from": was_active, "to": active}})
        self._enqueue(row, base_version=base_version)
        self._commit()

    def _soft_delete(self, row: Any, base_version: int, audit_changes: dict) -> None:
        """tombstone: يبقى السجل في الجدول ويُنشر للمزامنة. افحص النسخة وقواعدك قبل الاستدعاء."""
        row.mark_deleted()
        self._audit(row, "delete", audit_changes)
        self._enqueue(row, base_version=base_version, op=OutboxOp.DELETE)
        self._commit()

    def _run_bulk(
        self, data: BulkIn, action: Callable[[BulkItemIn], None]
    ) -> BulkResultOut:
        return run_bulk(self.session, data, action)

    def _bulk_deactivate(
        self, data: BulkIn, get_row: Callable[[str], Any]
    ) -> BulkResultOut:
        def action(item: BulkItemIn) -> None:
            row = get_row(item.id)
            if row.is_active:  # المعطّل أصلاً = نجاح بدون تغيير
                self._set_active(row, False, item.base_version)

        return self._run_bulk(data, action)