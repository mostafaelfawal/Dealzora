"""تعليق واسترجاع الفواتير. الاسترجاع ذري: داخل BEGIN IMMEDIATE (core.database) لا يأخذ
جهازان نفس الفاتورة أبداً — الثاني يحصل على رسالة أنها استُرجعت من جهاز آخر."""

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import utcnow, uuid7
from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.core.lookups import user_names
from app.core.security import Actor
from app.core.text import collapse_spaces
from app.modules.shifts.service import ShiftService

from .model import HeldInvoice

ENTITY_HELD = "held_invoice"
MAX_PAYLOAD_BYTES = 256 * 1024
MAX_LINES = 300


def _summary(payload: dict[str, Any]) -> tuple[int, int, str | None]:
    """عدد الأصناف والإجمالي (قروش) واسم العميل للعرض. لا نثق بها في أي حساب."""
    lines = payload.get("lines")
    if not isinstance(lines, list) or not lines:
        raise BadRequestError("held_empty", "لا يمكن تعليق فاتورة فارغة")
    if len(lines) > MAX_LINES:
        raise BadRequestError("held_too_large", "الفاتورة أكبر من المسموح للتعليق")
    total = 0.0
    for line in lines:
        if not isinstance(line, dict):
            raise BadRequestError("held_invalid", "بيانات الفاتورة غير صالحة")
        try:
            gross = float(line.get("price", 0)) * float(line.get("qty", 0))
            total += max(gross - float(line.get("discount") or 0), 0)
        except (TypeError, ValueError) as exc:
            raise BadRequestError("held_invalid", "بيانات الفاتورة غير صالحة") from exc
    customer = payload.get("customer")
    name = customer.get("name") if isinstance(customer, dict) else None
    name = collapse_spaces(str(name))[:120] if name else None
    return len(lines), round(total * 100), name


class HeldService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    # ---------- قراءة ----------
    def list_all(self) -> list[dict[str, Any]]:
        from app.modules.devices.service import device_names  # متأخر: تفادي الدوران

        rows = list(
            self.session.scalars(
                select(HeldInvoice)
                .where(HeldInvoice.deleted_at.is_(None))
                .order_by(HeldInvoice.created_at.desc())
            ).all()
        )
        users = user_names(self.session, [r.created_by for r in rows if r.created_by])
        devices = device_names(self.session)
        return [self._out(r, users, devices) for r in rows]

    # ---------- كتابة ----------
    def hold(self, payload: dict[str, Any]) -> dict[str, Any]:
        if len(json.dumps(payload, ensure_ascii=False).encode()) > MAX_PAYLOAD_BYTES:
            raise BadRequestError("held_too_large", "الفاتورة أكبر من المسموح للتعليق")
        items, total, customer = _summary(payload)
        shift = ShiftService(self.session, self.actor).require_open()  # التعليق داخل وردية هذا الجهاز
        row = HeldInvoice(
            id=uuid7(),
            shift_id=shift.id,
            payload=payload,
            item_count=items,
            total=total,
            customer_name=customer,
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
        )
        self.session.add(row)
        self.session.flush()
        self._audit(row, "hold", {"items": items, "total": total})
        self.session.commit()
        return self.list_one(row)

    def recall(self, held_id: str) -> dict[str, Any]:
        row = self._live(held_id)
        payload = row.payload
        row.mark_deleted()
        self._audit(row, "recall", {"items": row.item_count, "total": row.total})
        self.session.commit()
        return payload

    def discard(self, held_id: str) -> None:
        row = self._live(held_id)
        if not self.actor.is_management and row.created_by != self.actor.user_id:
            raise ForbiddenError("held_not_yours", "حذف فاتورة معلّقة لكاشير آخر للمدير فقط")
        row.mark_deleted()
        self._audit(row, "discard", {"items": row.item_count, "total": row.total})
        self.session.commit()

    # ---------- للورديات (بدون commit) ----------
    @staticmethod
    def clear_for_shift(session: Session, shift_id: str) -> int:
        """قفل الوردية: معلّقاتها تُحذف في نفس المعاملة."""
        now: datetime = utcnow()
        result = session.execute(
            update(HeldInvoice)
            .where(HeldInvoice.shift_id == shift_id, HeldInvoice.deleted_at.is_(None))
            .values(deleted_at=now, updated_at=now, version=HeldInvoice.version + 1)
        )
        return int(result.rowcount or 0)

    # ---------- داخلي ----------
    def _live(self, held_id: str) -> HeldInvoice:
        row = self.session.scalars(
            select(HeldInvoice).where(HeldInvoice.id == held_id, HeldInvoice.deleted_at.is_(None))
        ).first()
        if row is None:
            raise NotFoundError(
                "held_not_found",
                "الفاتورة المعلّقة لم تعد موجودة: استُرجعت من جهاز آخر أو قُفلت ورديتها",
            )
        return row

    def list_one(self, row: HeldInvoice) -> dict[str, Any]:
        from app.modules.devices.service import device_names

        users = user_names(self.session, [row.created_by] if row.created_by else [])
        return self._out(row, users, device_names(self.session))

    @staticmethod
    def _out(r: HeldInvoice, users: dict[str, str], devices: dict[str, str]) -> dict[str, Any]:
        return {
            "id": r.id,
            "held_at": r.created_at,
            "invoice": r.payload,
            "item_count": r.item_count,
            "total": r.total,
            "customer_name": r.customer_name,
            "cashier_name": users.get(r.created_by) if r.created_by else None,
            "device_name": devices.get(r.device_id),
        }

    def _audit(self, row: HeldInvoice, action: str, changes: dict[str, Any]) -> None:
        record_audit(
            self.session, self.actor, entity=ENTITY_HELD, entity_id=row.id, action=action, changes=changes
        )  # fmt: skip
