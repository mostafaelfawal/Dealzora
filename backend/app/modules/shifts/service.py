"""قواعد الورديات. فتح/قفل = Audit + Outbox (+ حركة خزنة للعجز/الزيادة) ثم commit واحد.

الدرج = فكّة البداية + كاش المبيعات − كاش المرتجعات. الكاشير يعدّ "أعمى":
لا يرى المتوقع ولا الفرق، والمدير يراهما في صفحة الورديات.
"""

from sqlalchemy.orm import Session

from app.core.base import utcnow, uuid7
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.lookups import user_names
from app.core.periods import local_today
from app.core.security import Actor
from app.core.service_base import EntityService

from .constants import ENTITY_SHIFT, ERROR_MESSAGES, SHIFT_SNAPSHOT_FIELDS, ShiftError
from .model import Shift
from .repository import ShiftRepository
from .schema import ShiftCloseIn, ShiftListOut, ShiftListQuery, ShiftOpenIn, ShiftOut
from .types import ShiftTotals


class ShiftService(EntityService):
    entity = ENTITY_SHIFT
    messages = ERROR_MESSAGES
    version_conflict_error = ShiftError.ALREADY_OPEN
    unique_conflict_error = ShiftError.ALREADY_OPEN  # سباق فتح ورديتين في نفس اللحظة
    snapshot_fields = SHIFT_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = ShiftRepository(session)

    # ================= قراءة =================
    def current(self) -> ShiftOut | None:
        shift = self.repo.current(self.actor.device_id)
        return self._to_out(shift) if shift else None

    def list_shifts(self, query: ShiftListQuery) -> ShiftListOut:
        rows, total = self.repo.list_shifts(query.page, query.page_size)
        totals = self.repo.totals([r.id for r in rows])
        names = user_names(self.session, [r.cashier_id for r in rows])
        return ShiftListOut(
            items=[self._to_out(r, totals[r.id], names) for r in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def get_shift(self, shift_id: str) -> ShiftOut:
        return self._to_out(self._get_or_404(shift_id))

    # ================= كتابة =================
    def open_shift(self, data: ShiftOpenIn) -> ShiftOut:
        if self.repo.current(self.actor.device_id) is not None:
            raise self._err(ConflictError, ShiftError.ALREADY_OPEN)
        shift = Shift(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            cashier_id=self.actor.user_id,
            is_open=True,
            opened_at=utcnow(),
            opening_float=data.opening_float,
        )
        self.repo.add(shift)
        self.repo.flush()
        self._audit(shift, "open", {"opening_float": data.opening_float})
        self._enqueue(shift, base_version=None)
        self._commit()
        return self._to_out(shift)

    def close_current(self, data: ShiftCloseIn) -> ShiftOut:
        shift = self.repo.current(self.actor.device_id)
        if shift is None:
            raise self._err(NotFoundError, ShiftError.NO_OPEN_SHIFT)
        if not self.is_manager and shift.cashier_id != self.actor.user_id:
            raise self._err(ForbiddenError, ShiftError.NOT_YOURS)

        totals = self.repo.totals([shift.id])[shift.id]
        expected = totals.expected(shift.opening_float)
        base_version = shift.version
        shift.is_open = False
        shift.closed_at = utcnow()
        shift.closed_by = self.actor.user_id
        shift.expected_cash = expected
        shift.counted_cash = data.counted_cash
        shift.difference = data.counted_cash - expected
        shift.note = data.note
        shift.mark_modified()
        self.repo.flush()

        if shift.difference:
            self._post_difference(shift)
        # المعلّقة تخص هذه الوردية فقط: تُحذف معها في نفس المعاملة.
        from app.modules.held.service import HeldService  # متأخر: held يستورد ShiftService

        held_cleared = HeldService.clear_for_shift(self.session, shift.id)
        self._audit(
            shift,
            "close",
            {
                "expected_cash": expected,
                "counted_cash": data.counted_cash,
                "difference": shift.difference,
                **({"held_cleared": held_cleared} if held_cleared else {}),
            },
        )
        self._enqueue(shift, base_version=base_version)
        self._commit()
        return self._to_out(shift, totals)

    # ================= واجهة للموديولات الأخرى =================
    def require_open(self) -> Shift:
        """البيع والمرتجع لا يتمّان بدون وردية مفتوحة."""
        shift = self.repo.current(self.actor.device_id)
        if shift is None:
            raise self._err(ConflictError, ShiftError.NO_OPEN_SHIFT)
        return shift

    # ================= داخلي =================
    def _get_or_404(self, shift_id: str) -> Shift:
        shift = self.repo.get(shift_id)
        if shift is None:
            raise self._err(NotFoundError, ShiftError.NOT_FOUND)
        return shift

    def _post_difference(self, shift: Shift) -> None:
        """العجز يخرج من الخزنة والزيادة تدخلها، فيطابق رصيد الخزنة النقدية الفعلية."""
        from app.modules.treasury.service import TreasuryService
        from app.modules.treasury.types import CashDirection, CashKind

        diff = shift.difference or 0
        TreasuryService(self.session, self.actor).post_entry(
            direction=CashDirection.IN if diff > 0 else CashDirection.OUT,
            kind=CashKind.SHIFT_DIFF,
            amount=abs(diff),
            occurred_at=local_today(),
            note="زيادة في الدرج عند قفل الوردية" if diff > 0 else "عجز في الدرج عند قفل الوردية",
            source_entity=ENTITY_SHIFT,
            source_id=shift.id,
        )

    def _device_names(self) -> dict[str, str]:
        if not hasattr(self, "_names_cache"):
            from app.modules.devices.service import device_names  # متأخر: تفادي الدوران

            self._names_cache = device_names(self.session)
        return self._names_cache

    def _to_out(
        self,
        s: Shift,
        totals: ShiftTotals | None = None,
        names: dict[str, str] | None = None,
    ) -> ShiftOut:
        totals = totals or self.repo.totals([s.id])[s.id]
        names = names if names is not None else user_names(self.session, [s.cashier_id])
        mgr = self.is_manager
        expected = (
            s.expected_cash if s.expected_cash is not None else totals.expected(s.opening_float)
        )
        return ShiftOut(
            id=s.id,
            cashier_id=s.cashier_id,
            cashier_name=names.get(s.cashier_id),
            device_name=self._device_names().get(s.device_id),
            is_open=s.is_open,
            opened_at=s.opened_at,
            closed_at=s.closed_at,
            opening_float=s.opening_float,
            sales_count=totals.sales_count,
            returns_count=totals.returns_count,
            sales_total=totals.sales_total if mgr else None,
            cash_sales=totals.cash_sales if mgr else None,
            credit_sales=totals.credit_sales if mgr else None,
            cash_refunds=totals.cash_refunds if mgr else None,
            vodafone_sales=totals.vodafone_sales if mgr else None,
            instapay_sales=totals.instapay_sales if mgr else None,
            wallet_refunds=totals.wallet_refunds if mgr else None,
            expected_cash=expected if mgr else None,
            counted_cash=s.counted_cash,
            difference=s.difference if mgr else None,
            note=s.note,
            version=s.version,
        )
