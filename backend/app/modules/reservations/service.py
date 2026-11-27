"""قواعد الحجز. كل أمر كتابة = معاملة واحدة (الحجز + العربون في كشف العميل والخزنة + Audit).

دورة الحجز: قيد التجهيز ← جاهز للاستلام ← مُستلَم (فاتورة بيع من الكاشير) أو ملغى.
- العربون: رصيد للعميل لدى المحل (حركة «عربون حجز») ونقدية داخلة لدرج الوردية.
- الاستلام: الكاشير يحمّل الحجز في الفاتورة ويدفع العميل الباقي بعد خصم العربون من رصيده؛
  الفاتورة تُغلق الحجز في نفس معاملة البيع (mark_picked_up).
- الإلغاء: العربون يبقى رصيداً للعميل (يُستخدم في أي فاتورة أو يُصرف نقداً من صفحة العملاء).
"""

import json
from datetime import date
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import utcnow, uuid7
from app.core.errors import (
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.lookups import user_names
from app.core.periods import local_today
from app.core.repository import fetch_page, like_contains, live, sum_if
from app.core.security import Actor
from app.core.text import build_search_text, collapse_spaces

from .constants import (
    ENTITY_RESERVATION,
    ERROR_MESSAGES,
    MAX_LINES,
    MAX_PAYLOAD_BYTES,
    OPEN_STATUSES,
    REF_RESERVATION,
    STATUS_NAMES,
    ReservationError,
    ReservationFilter,
    ReservationStatus,
)
from .model import Reservation
from .schema import (
    ReservationCounts,
    ReservationCreate,
    ReservationListOut,
    ReservationListQuery,
    ReservationOut,
    ReservationUpdate,
)

_OPEN = [s.value for s in OPEN_STATUSES]


def _err(cls: type[AppError], code: ReservationError, **fmt: Any) -> AppError:
    return cls(code.value, ERROR_MESSAGES[code].format(**fmt), fmt or None)


def _summary(payload: dict[str, Any]) -> tuple[int, int]:
    """عدد الأصناف والإجمالي التقديري (قروش) للعرض. لا نثق بهما في أي حساب."""
    lines = payload.get("lines")
    if not isinstance(lines, list) or not lines:
        raise _err(BadRequestError, ReservationError.EMPTY)
    if len(lines) > MAX_LINES:
        raise _err(BadRequestError, ReservationError.TOO_LARGE)
    total = 0.0
    for line in lines:
        if not isinstance(line, dict) or not isinstance(line.get("productId"), str):
            raise _err(BadRequestError, ReservationError.INVALID)
        try:
            gross = float(line.get("price", 0)) * float(line.get("qty", 0))
            total += max(gross - float(line.get("discount") or 0) - float(line.get("promo") or 0), 0)
        except (TypeError, ValueError) as exc:
            raise _err(BadRequestError, ReservationError.INVALID) from exc
    return len(lines), round(total * 100)


class ReservationService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    # ================= قراءة =================
    def list_reservations(self, query: ReservationListQuery) -> ReservationListOut:
        today = local_today()
        conds = [live(Reservation)]
        f = query.filter
        if f is ReservationFilter.OPEN:
            conds.append(Reservation.status.in_(_OPEN))
        elif f is ReservationFilter.OVERDUE:
            conds += [Reservation.status.in_(_OPEN), Reservation.pickup_on < today]
        elif f is not ReservationFilter.ALL:
            conds.append(Reservation.status == f.value)
        term = query.q.strip()
        if term:
            text_cond = like_contains(Reservation.search_text, term)
            parts = [c for c in (text_cond,) if c is not None]
            if term.isdigit():
                parts.append(Reservation.number == int(term))
            if parts:
                conds.append(or_(*parts))
        # المفتوح: الأقرب موعداً أولاً (بلا موعد في الآخر). غيره: الأحدث أولاً.
        if f in (ReservationFilter.OPEN, ReservationFilter.PENDING, ReservationFilter.READY, ReservationFilter.OVERDUE):
            order = [Reservation.pickup_on.is_(None), Reservation.pickup_on, Reservation.number]
        else:
            order = [Reservation.number.desc()]
        rows, total = fetch_page(self.session, Reservation, conds, order, query.page, query.page_size)
        return ReservationListOut(
            items=self._out(rows),
            total=total,
            page=query.page,
            page_size=query.page_size,
            counts=self._counts(today),
        )

    def get(self, reservation_id: str) -> ReservationOut:
        return self._out([self._get_or_404(reservation_id)])[0]

    def open_for_customer(self, customer_id: str) -> list[ReservationOut]:
        """حجوزات العميل المفتوحة (تنبيه الكاشير عند اختيار العميل)."""
        rows = self.session.scalars(
            select(Reservation)
            .where(live(Reservation), Reservation.customer_id == customer_id, Reservation.status.in_(_OPEN))
            .order_by(Reservation.number)
        ).all()
        return self._out(list(rows))

    # ================= كتابة =================
    def create(self, data: ReservationCreate) -> ReservationOut:
        existing = self.session.scalars(
            select(Reservation).where(Reservation.client_ref == data.client_ref)
        ).first()
        if existing is not None:
            return self._out([existing])[0]  # إعادة إرسال: نفس الحجز بدون تكرار

        payload = dict(data.invoice)
        if len(json.dumps(payload, ensure_ascii=False).encode()) > MAX_PAYLOAD_BYTES:
            raise _err(BadRequestError, ReservationError.TOO_LARGE)
        items, total = _summary(payload)
        if data.pickup_on and data.pickup_on < local_today():
            raise _err(BadRequestError, ReservationError.PICKUP_IN_PAST)

        from app.modules.customers.service import CustomerService

        customers = CustomerService(self.session, self.actor)
        customer = customers.get_for_update(data.customer_id)
        if not customer.is_active:
            raise _err(ConflictError, ReservationError.CUSTOMER_INACTIVE)

        number = (self.session.scalar(select(func.max(Reservation.number))) or 0) + 1
        row = Reservation(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            number=number,
            client_ref=data.client_ref,
            customer_id=customer.id,
            customer_name=collapse_spaces(customer.name)[:100],
            customer_phone=customer.phone,
            search_text=build_search_text(customer.name, [customer.phone])[:300],
            status=ReservationStatus.PENDING.value,
            pickup_on=data.pickup_on,
            payload=payload,
            item_count=items,
            total=total,
            deposit=data.deposit,
            note=data.note,
        )
        if data.deposit:
            self._take_deposit(row, customer, customers)
        self.session.add(row)
        self.session.flush()
        self._audit(
            row,
            "create",
            {
                "number": number,
                "customer_id": customer.id,
                "items": items,
                "total": total,
                "deposit": data.deposit,
                "pickup_on": data.pickup_on.isoformat() if data.pickup_on else None,
            },
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise _err(ConflictError, ReservationError.DUPLICATE) from exc
        return self._out([row])[0]

    def update(self, reservation_id: str, data: ReservationUpdate) -> ReservationOut:
        row = self._open_or_error(reservation_id)
        if data.pickup_on and data.pickup_on < local_today() and data.pickup_on != row.pickup_on:
            raise _err(BadRequestError, ReservationError.PICKUP_IN_PAST)
        before = {"pickup_on": row.pickup_on.isoformat() if row.pickup_on else None, "note": row.note}
        row.pickup_on = data.pickup_on
        row.note = data.note
        row.mark_modified()
        after = {"pickup_on": row.pickup_on.isoformat() if row.pickup_on else None, "note": row.note}
        self._audit(row, "update", {"before": before, "after": after})
        self.session.commit()
        return self._out([row])[0]

    def set_ready(self, reservation_id: str, ready: bool) -> ReservationOut:
        row = self._open_or_error(reservation_id)
        target = ReservationStatus.READY if ready else ReservationStatus.PENDING
        if row.status != target.value:
            row.status = target.value
            row.mark_modified()
            self._audit(row, "ready" if ready else "unready", {"status": target.value})
            self.session.commit()
        return self._out([row])[0]

    def cancel(self, reservation_id: str) -> ReservationOut:
        row = self._open_or_error(reservation_id)
        if not self.actor.is_management and row.created_by != self.actor.user_id:
            raise _err(ForbiddenError, ReservationError.NOT_YOURS)
        row.status = ReservationStatus.CANCELLED.value
        row.closed_at = utcnow()
        row.closed_by = self.actor.user_id
        row.mark_modified()
        # العربون يبقى رصيداً للعميل لدى المحل (لا حركة مالية هنا).
        self._audit(row, "cancel", {"deposit_kept_as_credit": row.deposit})
        self.session.commit()
        return self._out([row])[0]

    # ================= واجهة للمبيعات (بدون commit) =================
    @staticmethod
    def mark_picked_up(
        session: Session, actor: Actor, reservation_id: str, *, sale_id: str, sale_number: int, customer_id: str | None
    ) -> None:
        """فاتورة الاستلام تُغلق الحجز في نفس معاملتها. حجز مستلم/ملغى = رفض الفاتورة كلها."""
        row = session.scalars(
            select(Reservation).where(Reservation.id == reservation_id, live(Reservation))
        ).first()
        if row is None:
            raise _err(NotFoundError, ReservationError.NOT_FOUND)
        if row.status not in _OPEN:
            raise _err(ConflictError, ReservationError.NOT_OPEN, status=STATUS_NAMES[ReservationStatus(row.status)])
        if customer_id != row.customer_id:
            raise _err(BadRequestError, ReservationError.CUSTOMER_MISMATCH)
        row.status = ReservationStatus.PICKED_UP.value
        row.sale_id = sale_id
        row.closed_at = utcnow()
        row.closed_by = actor.user_id
        row.mark_modified()
        record_audit(
            session, actor, entity=ENTITY_RESERVATION, entity_id=row.id, action="pickup",
            changes={"sale_id": sale_id, "sale_number": sale_number, "deposit": row.deposit},
        )  # fmt: skip

    @staticmethod
    def shift_deposits(session: Session, shift_ids: list[str]) -> dict[str, int]:
        """عرابين دخلت درج كل وردية (للكاش المتوقع عند القفل)."""
        if not shift_ids:
            return {}
        return {
            sid: int(total or 0)
            for sid, total in session.execute(
                select(Reservation.deposit_shift_id, func.sum(Reservation.deposit))
                .where(Reservation.deposit_shift_id.in_(shift_ids), live(Reservation))
                .group_by(Reservation.deposit_shift_id)
            ).all()
        }

    # ================= داخلي =================
    def _take_deposit(self, row: Reservation, customer: Any, customers: Any) -> None:
        """العربون نقدية في درج الوردية الحالية، ورصيد للعميل يُدفع منه عند الاستلام."""
        from app.modules.customers.types import LedgerType
        from app.modules.customers.constants import ENTITY_LEDGER_ENTRY
        from app.modules.shifts.service import ShiftService
        from app.modules.treasury.service import TreasuryService
        from app.modules.treasury.types import CashDirection, CashKind

        if customer.balance > 0:
            # العربون على عميل مدين يُسدّد دينه بدلاً من أن يبقى للحجز.
            raise _err(BadRequestError, ReservationError.CUSTOMER_HAS_DEBT, debt=f"{customer.balance / 100:.2f}")
        shift = ShiftService(self.session, self.actor).require_open()
        row.deposit_shift_id = shift.id
        entry = customers.post_entry(
            customer,
            LedgerType.RESERVATION_DEPOSIT,
            credit=row.deposit,
            note=f"عربون حجز #{row.number}",
            ref_type=REF_RESERVATION,
            ref_id=row.id,
        )
        TreasuryService(self.session, self.actor).post_entry(
            direction=CashDirection.IN,
            kind=CashKind.CUSTOMER_DEPOSIT,
            amount=row.deposit,
            occurred_at=local_today(),
            note=f"عربون حجز #{row.number} من {customer.name}",
            source_entity=ENTITY_LEDGER_ENTRY,
            source_id=entry.id,
        )

    def _get_or_404(self, reservation_id: str) -> Reservation:
        row = self.session.scalars(
            select(Reservation).where(Reservation.id == reservation_id, live(Reservation))
        ).first()
        if row is None:
            raise _err(NotFoundError, ReservationError.NOT_FOUND)
        return row

    def _open_or_error(self, reservation_id: str) -> Reservation:
        row = self._get_or_404(reservation_id)
        if row.status not in _OPEN:
            raise _err(ConflictError, ReservationError.NOT_OPEN, status=STATUS_NAMES[ReservationStatus(row.status)])
        return row

    def _counts(self, today: date) -> ReservationCounts:
        is_open = Reservation.status.in_(_OPEN)
        pending, ready, overdue, due_today, deposits = self.session.execute(
            select(
                sum_if(Reservation.status == ReservationStatus.PENDING.value),
                sum_if(Reservation.status == ReservationStatus.READY.value),
                sum_if(is_open & (Reservation.pickup_on < today)),
                sum_if(is_open & (Reservation.pickup_on == today)),
                sum_if(is_open, Reservation.deposit),
            ).where(live(Reservation))
        ).one()
        return ReservationCounts(
            pending=int(pending or 0),
            ready=int(ready or 0),
            overdue=int(overdue or 0),
            due_today=int(due_today or 0),
            open_deposits=int(deposits or 0),
        )

    def _out(self, rows: list[Reservation]) -> list[ReservationOut]:
        from app.modules.customers.model import Customer
        from app.modules.sales.model import Sale

        if not rows:
            return []
        today = local_today()
        users = user_names(self.session, [r.created_by for r in rows])
        customer_ids = {r.customer_id for r in rows}
        balances = dict(
            self.session.execute(select(Customer.id, Customer.balance).where(Customer.id.in_(customer_ids))).all()
        )
        sale_ids = [r.sale_id for r in rows if r.sale_id]
        numbers = (
            dict(self.session.execute(select(Sale.id, Sale.number).where(Sale.id.in_(sale_ids))).all())
            if sale_ids
            else {}
        )
        return [
            ReservationOut(
                id=r.id,
                number=r.number,
                status=r.status,
                customer_id=r.customer_id,
                customer_name=r.customer_name,
                customer_phone=r.customer_phone,
                customer_balance=balances.get(r.customer_id),
                pickup_on=r.pickup_on,
                is_overdue=bool(r.status in _OPEN and r.pickup_on and r.pickup_on < today),
                deposit=r.deposit,
                total=r.total,
                item_count=r.item_count,
                note=r.note,
                invoice=r.payload,
                created_at=r.created_at,
                cashier_name=users.get(r.created_by) if r.created_by else None,
                sale_id=r.sale_id,
                sale_number=numbers.get(r.sale_id) if r.sale_id else None,
                closed_at=r.closed_at,
            )
            for r in rows
        ]

    def _audit(self, row: Reservation, action: str, changes: dict[str, Any]) -> None:
        record_audit(
            self.session, self.actor, entity=ENTITY_RESERVATION, entity_id=row.id, action=action, changes=changes
        )  # fmt: skip
