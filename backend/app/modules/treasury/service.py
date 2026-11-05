"""قواعد العمل. كل أمر كتابة = حركة + Audit + Outbox ثم commit واحد.

هذا الـ service هو الواجهة العامة للخزنة لباقي الموديولات (المصروفات الآن، ولاحقاً المبيعات والمشتريات):
- post_entry / upsert_source_entry / void_source_entry: لا يعملون commit أبداً،
  لأن الموديول المستدعي يملك المعاملة (المصدر + الحركة + Audit + Outbox في commit واحد).
- create_manual / delete_manual: أوامر الخزنة نفسها وتعمل commit.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.errors import ForbiddenError, NotFoundError
from app.core.outbox import OutboxOp
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.snapshots import diff_snapshots

from .constants import CASH_SNAPSHOT_FIELDS, ENTITY_CASH_ENTRY, ERROR_MESSAGES, TreasuryError
from .model import CashEntry
from .repository import CashRepository
from .schema import (
    CashEntryOut,
    CashListOut,
    CashListQuery,
    ManualEntryCreate,
    TreasurySummaryOut,
)
from .types import MANUAL_KINDS, CashDirection, CashFilters, CashKind


class TreasuryService(EntityService):
    entity = ENTITY_CASH_ENTRY
    messages = ERROR_MESSAGES
    version_conflict_error = TreasuryError.VERSION_CONFLICT
    snapshot_fields = CASH_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = CashRepository(session)

    # ================= قراءة =================
    def list_entries(self, query: CashListQuery) -> CashListOut:
        filters = CashFilters(
            direction=query.direction,
            kind=query.kind,
            date_from=query.date_from,
            date_to=query.date_to,
            sort=query.sort,
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_entries(filters)
        names = self._names(rows)
        return CashListOut(
            items=[self._to_out(e, names) for e in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def summary(self) -> TreasurySummaryOut:
        s = self.repo.summary(date.today())  # يوم الجهاز المحلي، مثل المصروفات
        return TreasurySummaryOut(
            balance=s.balance,
            total_in=s.total_in,
            total_out=s.total_out,
            today_in=s.today_in,
            today_out=s.today_out,
            month_in=s.month_in,
            month_out=s.month_out,
        )

    # ================= كتابة: أوامر الخزنة (يدوي فقط) =================
    def create_manual(self, data: ManualEntryCreate) -> CashEntryOut:
        kind = CashKind.MANUAL_IN if data.direction is CashDirection.IN else CashKind.MANUAL_OUT
        entry = self.post_entry(
            direction=data.direction,
            kind=kind,
            amount=data.amount,
            occurred_at=data.occurred_at,
            note=data.note,
        )
        self._commit()
        return self._to_out(entry, self._names([entry]))

    def delete_manual(self, entry_id: str, base_version: int) -> None:
        entry = self.repo.get(entry_id)
        if entry is None:
            raise self._err(NotFoundError, TreasuryError.NOT_FOUND)
        if CashKind(entry.kind) not in MANUAL_KINDS:
            raise self._err(ForbiddenError, TreasuryError.LOCKED, kind=entry.kind)
        self._check_version(entry, base_version)
        self._soft_delete(entry, base_version, self._snapshot(entry))

    # ================= واجهة للموديولات الأخرى (بدون commit) =================
    def post_entry(
        self,
        *,
        direction: CashDirection,
        kind: CashKind,
        amount: int,
        occurred_at: date,
        note: str | None = None,
        source_entity: str | None = None,
        source_id: str | None = None,
    ) -> CashEntry:
        entry = CashEntry(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            direction=direction.value,
            kind=kind.value,
            amount=amount,
            occurred_at=occurred_at,
            note=note,
            source_entity=source_entity,
            source_id=source_id,
        )
        self.repo.add(entry)
        self.repo.flush()

        self._audit(entry, "create", self._snapshot(entry))
        self._enqueue(entry, base_version=None)
        return entry

    def upsert_source_entry(
        self,
        *,
        source_entity: str,
        source_id: str,
        direction: CashDirection,
        kind: CashKind,
        amount: int,
        occurred_at: date,
        note: str | None = None,
    ) -> CashEntry:
        """يحدّث حركة المصدر لو موجودة، أو ينشئها (مصاريف قديمة قبل وجود الخزنة)."""
        entry = self.repo.get_by_source(source_entity, source_id)
        if entry is None:
            return self.post_entry(
                direction=direction,
                kind=kind,
                amount=amount,
                occurred_at=occurred_at,
                note=note,
                source_entity=source_entity,
                source_id=source_id,
            )

        before = self._snapshot(entry)
        base_version = entry.version
        entry.direction = direction.value
        entry.kind = kind.value
        entry.amount = amount
        entry.occurred_at = occurred_at
        entry.note = note
        after = self._snapshot(entry)
        if before == after:
            return entry  # لا تغيير فعلي: لا نرفع النسخة ولا نكتب Outbox

        entry.mark_modified()
        self.repo.flush()
        self._audit(entry, "update", diff_snapshots(before, after))
        self._enqueue(entry, base_version=base_version)
        return entry

    def void_source_entry(self, *, source_entity: str, source_id: str) -> None:
        """حذف ناعم لحركة المصدر (يرجّع المبلغ للخزنة). لو مفيش حركة نتجاهل."""
        entry = self.repo.get_by_source(source_entity, source_id)
        if entry is None:
            return
        base_version = entry.version
        entry.mark_deleted()
        self._audit(entry, "delete", self._snapshot(entry))
        self._enqueue(entry, base_version=base_version, op=OutboxOp.DELETE)

    # ================= داخلي =================
    def _names(self, rows: list[CashEntry]) -> dict[str, str]:
        return self.repo.user_names(e.created_by for e in rows if e.created_by)

    @staticmethod
    def _to_out(e: CashEntry, names: dict[str, str]) -> CashEntryOut:
        return CashEntryOut(
            id=e.id,
            direction=e.direction,
            kind=e.kind,
            amount=e.amount,
            note=e.note,
            occurred_at=e.occurred_at,
            source_entity=e.source_entity,
            source_id=e.source_id,
            created_by_name=names.get(e.created_by) if e.created_by else None,
            version=e.version,
            created_at=e.created_at,
        )