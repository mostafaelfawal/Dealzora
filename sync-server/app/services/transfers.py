"""تحويلات المخزون بين فروع نفس المحل. السيرفر يملك الحالة ويتحقق من كل انتقال ومن صاحبه:

    طلب (فرع الاستلام يطلب):
        requested ──موافقة وإرسال (فرع الإرسال)──► sent
                  ├─رفض (فرع الإرسال)───────────► rejected
                  └─سحب (صاحب الطلب)────────────► withdrawn
    إرسال مباشر (فرع الإرسال):
        sent ──استلام (فرع الاستلام فقط)──► received / partial (بعجز)
             └─إلغاء (فرع الإرسال فقط)───► cancelled

كل انتقال يضيف حدثاً entity="stock_transfer" **موجّهاً للطرف الآخر فقط** (لا يراه باقي الفروع)،
ويُسجَّل في السجل الأمني. الطلبات قابلة للإعادة بأمان (نفس id / نفس الحالة = نفس النتيجة).
"""

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import record
from ..db import utcnow
from ..errors import BadRequest, Conflict, Forbidden, NotFound
from ..models import Branch, Shop, Transfer, TransferLine
from ..schemas import (
    ApproveIn,
    ReceiveIn,
    RejectIn,
    TransferIn,
    TransferLineOut,
    TransferListOut,
    TransferOut,
    TransferRequestIn,
    TransferStatus,
)
from ..security import Caller
from .events import append_system_event, lock_shop

ENTITY = "stock_transfer"
S = TransferStatus


# ================= عرض =================
def _names(session: Session, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    return dict(session.execute(select(Branch.id, Branch.name).where(Branch.id.in_(ids))).all())


def to_out(session: Session, transfers: list[Transfer]) -> list[TransferOut]:
    names = _names(session, {b for t in transfers for b in (t.from_branch_id, t.to_branch_id)})
    out = []
    for t in transfers:
        shipped = t.status not in (S.REQUESTED, S.REJECTED, S.WITHDRAWN)
        total = sum(l.qty_sent * l.unit_cost // 1000 for l in t.lines) if shipped else 0
        shortage = sum(
            (l.qty_sent - l.qty_received) * l.unit_cost // 1000
            for l in t.lines
            if l.qty_received is not None and l.qty_received < l.qty_sent
        )
        out.append(
            TransferOut(
                id=t.id,
                number=t.number,
                from_branch_id=t.from_branch_id,
                from_branch_name=names.get(t.from_branch_id, "؟"),
                to_branch_id=t.to_branch_id,
                to_branch_name=names.get(t.to_branch_id, "؟"),
                status=S(t.status),
                note=t.note,
                receive_note=t.receive_note,
                sent_by=t.sent_by,
                received_by=t.received_by,
                requested_by=t.requested_by,
                requested_at=t.requested_at,
                rejected_at=t.rejected_at,
                reject_reason=t.reject_reason,
                sent_at=t.sent_at,
                received_at=t.received_at,
                cancelled_at=t.cancelled_at,
                version=t.version,
                total_cost=total,
                shortage_cost=shortage,
                lines=[
                    TransferLineOut(
                        id=l.id,
                        product_id=l.product_id,
                        barcode=l.barcode,
                        name=l.name,
                        unit=l.unit,
                        qty_requested=l.qty_requested,
                        qty_sent=l.qty_sent,
                        qty_received=l.qty_received,
                        unit_cost=l.unit_cost,
                        batch_no=l.batch_no,
                        expiry_date=l.expiry_date,
                    )
                    for l in t.lines
                ],
            )
        )
    return out


# ================= مساعدات =================
def _get(session: Session, caller: Caller, transfer_id: str, *, lock: bool = False) -> Transfer:
    stmt = select(Transfer).where(Transfer.id == transfer_id, Transfer.shop_id == caller.shop_id)
    if lock:
        stmt = stmt.with_for_update()
    transfer = session.execute(stmt).scalar_one_or_none()
    # فرع ليس طرفاً في التحويل لا يعرف حتى بوجوده (404 لا 403).
    if transfer is None or caller.branch_id not in (transfer.from_branch_id, transfer.to_branch_id):
        raise NotFound("transfer_not_found", "التحويل غير موجود")
    return transfer


def _other_branch(session: Session, caller: Caller, branch_id: str, *, role: str) -> Branch:
    if branch_id == caller.branch_id:
        raise BadRequest("transfer_same_branch", "لا يمكن التحويل لنفس الفرع")
    branch = session.get(Branch, branch_id)
    if branch is None or branch.shop_id != caller.shop_id:
        raise NotFound("branch_not_found", f"الفرع {role} غير موجود")
    if not branch.is_active:
        raise BadRequest("branch_disabled", f"الفرع {role} موقوف")
    return branch


def _require_active(session: Session, branch_id: str, role: str) -> None:
    branch = session.get(Branch, branch_id)
    if branch is None or not branch.is_active:
        raise BadRequest("branch_disabled", f"الفرع {role} موقوف")


def _emit(
    session: Session, shop: Shop, caller: Caller, transfer: Transfer, op: str
) -> None:
    """حدث للطرف الآخر فقط + سطر في السجل الأمني."""
    other = transfer.to_branch_id if caller.branch_id == transfer.from_branch_id else transfer.from_branch_id
    payload = to_out(session, [transfer])[0].model_dump(mode="json")
    append_system_event(
        session,
        shop=shop,
        branch_id=caller.branch_id,
        event_id=str(uuid.uuid4()),
        entity=ENTITY,
        entity_id=transfer.id,
        op=op,
        payload=payload,
        target_branch_id=other,
    )
    record(
        session, f"transfer_{op}", actor="branch", shop_id=caller.shop_id,
        branch_id=caller.branch_id, ip=caller.ip,
        details={"transfer_id": transfer.id, "number": transfer.number, "to": other},
    )  # fmt: skip


def _replay(session: Session, caller: Caller, transfer_id: str, *, as_sender: bool) -> Transfer | None:
    """إعادة نفس طلب الإنشاء (انقطاع بعد الحفظ) ترجع نفس التحويل؛ id مستخدم من غيرك = تعارض."""
    existing = session.get(Transfer, transfer_id)
    if existing is None:
        return None
    owner = existing.from_branch_id if as_sender else existing.to_branch_id
    if existing.shop_id == caller.shop_id and owner == caller.branch_id:
        return existing
    raise Conflict("transfer_id_taken", "معرّف التحويل مستخدم")


def _next_number(shop: Shop) -> int:
    shop.last_transfer_no += 1
    return shop.last_transfer_no


# ================= إرسال مباشر =================
def create(session: Session, caller: Caller, data: TransferIn) -> TransferOut:
    if (existing := _replay(session, caller, data.id, as_sender=True)) is not None:
        return to_out(session, [existing])[0]
    _other_branch(session, caller, data.to_branch_id, role="المستلم")

    shop = lock_shop(session, caller.shop_id)
    now = utcnow()
    transfer = Transfer(
        id=data.id,
        shop_id=caller.shop_id,
        number=_next_number(shop),
        from_branch_id=caller.branch_id,
        to_branch_id=data.to_branch_id,
        status=S.SENT.value,
        note=data.note,
        sent_by=data.sent_by,
        sent_at=now,
        version=1,
    )
    for i, line in enumerate(data.lines):
        transfer.lines.append(
            TransferLine(
                id=str(uuid.uuid4()),
                position=i,
                product_id=line.product_id,
                barcode=line.barcode,
                name=line.name,
                unit=line.unit,
                qty_sent=line.qty,
                unit_cost=line.unit_cost,
                batch_no=line.batch_no,
                expiry_date=line.expiry_date,
            )
        )
    session.add(transfer)
    session.flush()
    _emit(session, shop, caller, transfer, "sent")
    session.commit()
    return to_out(session, [transfer])[0]


# ================= طلب تحويل =================
def request(session: Session, caller: Caller, data: TransferRequestIn) -> TransferOut:
    if (existing := _replay(session, caller, data.id, as_sender=False)) is not None:
        return to_out(session, [existing])[0]
    _other_branch(session, caller, data.from_branch_id, role="المطلوب منه")

    shop = lock_shop(session, caller.shop_id)
    transfer = Transfer(
        id=data.id,
        shop_id=caller.shop_id,
        number=_next_number(shop),
        from_branch_id=data.from_branch_id,
        to_branch_id=caller.branch_id,
        status=S.REQUESTED.value,
        note=data.note,
        requested_by=data.requested_by,
        requested_at=utcnow(),
        version=1,
    )
    for i, line in enumerate(data.lines):
        transfer.lines.append(
            TransferLine(
                id=str(uuid.uuid4()),
                position=i,
                product_id=line.product_id,
                barcode=line.barcode,
                name=line.name,
                unit=line.unit,
                qty_requested=line.qty,
                qty_sent=line.qty,  # يتحدد فعلياً عند الموافقة
                unit_cost=0,
            )
        )
    session.add(transfer)
    session.flush()
    _emit(session, shop, caller, transfer, "requested")
    session.commit()
    return to_out(session, [transfer])[0]


def approve(session: Session, caller: Caller, transfer_id: str, data: ApproveIn) -> TransferOut:
    shop = lock_shop(session, caller.shop_id)
    transfer = _get(session, caller, transfer_id, lock=True)
    if transfer.from_branch_id != caller.branch_id:
        raise Forbidden("transfer_not_yours", "الموافقة من الفرع المطلوب منه فقط")
    if transfer.status == S.SENT.value:
        return to_out(session, [transfer])[0]  # نفس الطلب مرة ثانية
    if transfer.status != S.REQUESTED.value:
        raise Conflict("transfer_not_requested", "الطلب لم يعد في انتظار الرد")
    _require_active(session, transfer.to_branch_id, "الطالب")

    by_id = {l.id: l for l in transfer.lines}
    given = {}
    for item in data.lines:
        if item.line_id not in by_id:
            raise BadRequest("transfer_line_unknown", "سطر غير موجود في الطلب", {"line_id": item.line_id})
        given[item.line_id] = item
    for line in transfer.lines:
        item = given.get(line.id)
        if item is not None:
            line.qty_sent = item.qty
            line.unit_cost = item.unit_cost
            line.batch_no = item.batch_no
            line.expiry_date = item.expiry_date
    if not any(l.qty_sent > 0 for l in transfer.lines):
        raise BadRequest("transfer_empty", "لا توجد كميات للإرسال. استخدم الرفض بدلاً من ذلك")
    # الأسطر غير المتوفرة (0) تُحذف من التحويل.
    for line in [l for l in transfer.lines if l.qty_sent == 0]:
        transfer.lines.remove(line)

    transfer.status = S.SENT.value
    transfer.sent_at = utcnow()
    transfer.sent_by = data.sent_by
    if data.note:
        transfer.note = data.note
    transfer.version += 1
    session.flush()
    _emit(session, shop, caller, transfer, "sent")
    session.commit()
    return to_out(session, [transfer])[0]


def reject(session: Session, caller: Caller, transfer_id: str, data: RejectIn) -> TransferOut:
    shop = lock_shop(session, caller.shop_id)
    transfer = _get(session, caller, transfer_id, lock=True)
    if transfer.from_branch_id != caller.branch_id:
        raise Forbidden("transfer_not_yours", "الرفض من الفرع المطلوب منه فقط")
    if transfer.status == S.REJECTED.value:
        return to_out(session, [transfer])[0]
    if transfer.status != S.REQUESTED.value:
        raise Conflict("transfer_not_requested", "الطلب لم يعد في انتظار الرد")
    transfer.status = S.REJECTED.value
    transfer.rejected_at = utcnow()
    transfer.reject_reason = data.reason
    transfer.version += 1
    session.flush()
    _emit(session, shop, caller, transfer, "rejected")
    session.commit()
    return to_out(session, [transfer])[0]


def withdraw(session: Session, caller: Caller, transfer_id: str) -> TransferOut:
    shop = lock_shop(session, caller.shop_id)
    transfer = _get(session, caller, transfer_id, lock=True)
    if transfer.to_branch_id != caller.branch_id:
        raise Forbidden("transfer_not_yours", "سحب الطلب من الفرع الطالب فقط")
    if transfer.status == S.WITHDRAWN.value:
        return to_out(session, [transfer])[0]
    if transfer.status != S.REQUESTED.value:
        raise Conflict("transfer_not_requested", "لا يمكن سحب طلب تم الرد عليه")
    transfer.status = S.WITHDRAWN.value
    transfer.cancelled_at = utcnow()
    transfer.version += 1
    session.flush()
    _emit(session, shop, caller, transfer, "withdrawn")
    session.commit()
    return to_out(session, [transfer])[0]


# ================= الاستلام والإلغاء =================
def receive(session: Session, caller: Caller, transfer_id: str, data: ReceiveIn) -> TransferOut:
    shop = lock_shop(session, caller.shop_id)
    transfer = _get(session, caller, transfer_id, lock=True)
    if transfer.to_branch_id != caller.branch_id:
        raise Forbidden("transfer_not_yours", "الاستلام من الفرع المستلم فقط")
    if transfer.status in (S.RECEIVED.value, S.PARTIAL.value):
        return to_out(session, [transfer])[0]  # استُلم بالفعل (إعادة نفس الطلب)
    if transfer.status != S.SENT.value:
        raise Conflict("transfer_not_in_transit", "التحويل ليس في الطريق")

    by_id = {l.id: l for l in transfer.lines}
    given: dict[str, int] = {}
    for item in data.lines:
        line = by_id.get(item.line_id)
        if line is None:
            raise BadRequest("transfer_line_unknown", "سطر غير موجود في التحويل", {"line_id": item.line_id})
        if item.qty_received > line.qty_sent:
            raise BadRequest(
                "transfer_over_receive",
                "المستلم أكبر من المرسل",
                {"line_id": line.id, "sent": line.qty_sent},
            )
        given[line.id] = item.qty_received
    shortage = False
    for line in transfer.lines:
        line.qty_received = given.get(line.id, line.qty_sent)
        shortage |= line.qty_received < line.qty_sent

    transfer.status = (S.PARTIAL if shortage else S.RECEIVED).value
    transfer.received_at = utcnow()
    transfer.receive_note = data.note
    transfer.received_by = data.received_by
    transfer.version += 1
    session.flush()
    _emit(session, shop, caller, transfer, "received")
    session.commit()
    return to_out(session, [transfer])[0]


def cancel(session: Session, caller: Caller, transfer_id: str) -> TransferOut:
    shop = lock_shop(session, caller.shop_id)
    transfer = _get(session, caller, transfer_id, lock=True)
    if transfer.from_branch_id != caller.branch_id:
        raise Forbidden("transfer_not_yours", "الإلغاء من الفرع المرسل فقط")
    if transfer.status == S.CANCELLED.value:
        return to_out(session, [transfer])[0]
    if transfer.status != S.SENT.value:
        raise Conflict("transfer_already_received", "لا يمكن إلغاء تحويل ليس في الطريق")
    transfer.status = S.CANCELLED.value
    transfer.cancelled_at = utcnow()
    transfer.version += 1
    session.flush()
    _emit(session, shop, caller, transfer, "cancelled")
    session.commit()
    return to_out(session, [transfer])[0]


# ================= قراءة =================
def get_one(session: Session, caller: Caller, transfer_id: str) -> TransferOut:
    return to_out(session, [_get(session, caller, transfer_id)])[0]


def list_for(
    session: Session,
    caller: Caller,
    *,
    direction: str,
    status: TransferStatus | None,
    page: int,
    page_size: int,
) -> TransferListOut:
    """in = ما يخصني كمستلم (واردات وطلباتي)، out = ما يخصني كمرسل (صادرات وطلبات منّي)."""
    conds = [Transfer.shop_id == caller.shop_id]
    if direction == "in":
        conds.append(Transfer.to_branch_id == caller.branch_id)
    elif direction == "out":
        conds.append(Transfer.from_branch_id == caller.branch_id)
    else:
        conds.append(
            or_(Transfer.to_branch_id == caller.branch_id, Transfer.from_branch_id == caller.branch_id)
        )
    if status is not None:
        conds.append(Transfer.status == status.value)
    total = session.scalar(select(func.count()).select_from(Transfer).where(*conds)) or 0
    rows = list(
        session.scalars(
            select(Transfer)
            .where(*conds)
            .order_by(Transfer.number.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return TransferListOut(items=to_out(session, rows), total=total)
