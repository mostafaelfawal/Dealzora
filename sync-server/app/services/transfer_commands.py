"""تحويلات من الهاتف: عرض، رفض مباشر، وموافقة ينفّذها جهاز الفرع نفسه.

لماذا لا يوافق الهاتف على السيرفر مباشرة؟ الموافقة في البرنامج تخصم المخزون من دفعات الفرع (الأقرب صلاحية
أولاً) وتحسب التكلفة، ثم ترسل للسيرفر الكمية والتكلفة والدفعة. الهاتف لا يملك المخزون ولا التكلفة، فالموافقة
منه «أمر» يحفظه السيرفر، وجهاز الفرع يأخذه مع مزامنته وينفّذه بنفس مسار البرنامج حرفياً، فيكمل التحويل دورته
كما لو وُفق عليه من البرنامج. الرفض لا يحرّك مخزوناً، فيتم مباشرة (نفس ما يفعله البرنامج).

الصلاحيات = البرنامج: الموافقة والرفض من الفرع المطلوب منه فقط ← المالك، أو مدير هذا الفرع.
التعارض: الهاتف يرسل النسخة (version) التي رآها؛ تغيّرت من جهاز آخر = 409 transfer_changed مع الحالة الحالية.
أمر واحد نشط لكل تحويل (تحت قفل صف المحل)، والفرع «يستلم» الأمر قبل التنفيذ فلا يُنفَّذ مرتين.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import record
from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest, Conflict, Forbidden, NotFound
from ..mobile_security import MobileUser
from ..models import Branch, Transfer, TransferCommand
from ..schemas import (
    BranchCommandOut,
    CommandFailIn,
    MobileApproveIn,
    MobileRejectIn,
    MobileTransferListOut,
    MobileTransferOut,
    RejectIn,
    TransferCommandOut,
    TransferStatus,
)
from ..security import Caller
from . import transfers as transfers_svc
from .events import lock_shop

ACTIVE = ("pending", "executing")
S = TransferStatus


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


def _via(user: MobileUser) -> dict[str, Any]:
    return {"from_phone": True, "username": user.username, "session_id": user.session_id}


# ================= انتهاء المهلة والحسم التلقائي =================
def expire_stale(session: Session, shop_id: str) -> None:
    """أوامر لم يأخذها الفرع خلال المهلة (منقطع أو إصدار أقدم لا يعرف الأوامر) ← expired."""
    cutoff = utcnow() - timedelta(hours=get_settings().mobile_command_ttl_hours)
    rows = session.scalars(
        select(TransferCommand).where(
            TransferCommand.shop_id == shop_id, TransferCommand.status == "pending", TransferCommand.created_at < cutoff
        )
    ).all()
    for cmd in rows:
        _finish(session, cmd, "expired", "لم يأخذ الفرع الموافقة خلال المهلة (غير متصل أو يحتاج تحديث البرنامج)")
    if rows:
        session.commit()


def _finish(session: Session, cmd: TransferCommand, status: str, message: str | None = None, code: str | None = None) -> None:
    cmd.status = status
    cmd.resolved_at = utcnow()
    if message:
        cmd.error_message = message[:300]
    if code:
        cmd.error_code = code[:40]
    record(
        session, f"transfer_command_{status}", actor="system", shop_id=cmd.shop_id, branch_id=cmd.branch_id,
        details={"transfer_id": cmd.transfer_id, "command_id": cmd.id, "from_phone": True,
                 "username": cmd.requested_by, "device": cmd.device_name, **({"error": code} if code else {})},
    )  # fmt: skip


def resolve_for_transfer(session: Session, transfer: Transfer, op: str) -> None:
    """يُستدعى مع كل انتقال للتحويل (داخل نفس المعاملة): يحسم أوامر الهاتف النشطة عليه."""
    if op not in ("sent", "rejected", "withdrawn"):
        return
    rows = session.scalars(
        select(TransferCommand).where(TransferCommand.transfer_id == transfer.id, TransferCommand.status.in_(ACTIVE))
    ).all()
    for cmd in rows:
        if op == "sent" and cmd.status == "executing":
            _finish(session, cmd, "done")  # الفرع نفّذ موافقة الهاتف
        elif op == "sent":
            _finish(session, cmd, "superseded", "وُفق على الطلب من الفرع مباشرة")
        elif op == "rejected":
            _finish(session, cmd, "superseded", "رُفض الطلب قبل التنفيذ")
        else:
            _finish(session, cmd, "superseded", "سحب الفرع الطالب طلبه قبل التنفيذ")


# ================= العرض للهاتف =================
def _command_out(cmd: TransferCommand | None) -> TransferCommandOut | None:
    if cmd is None:
        return None
    return TransferCommandOut(
        id=cmd.id, action=cmd.action, status=cmd.status,  # type: ignore[arg-type]
        requested_by=cmd.requested_by, device_name=cmd.device_name,
        created_at=_aware(cmd.created_at), claimed_at=_aware(cmd.claimed_at),  # type: ignore[arg-type]
        resolved_at=_aware(cmd.resolved_at), error_message=cmd.error_message,
    )  # fmt: skip


def _latest_commands(session: Session, ids: list[str]) -> dict[str, TransferCommand]:
    if not ids:
        return {}
    rows = session.scalars(
        select(TransferCommand).where(TransferCommand.transfer_id.in_(ids)).order_by(TransferCommand.created_at)
    ).all()
    return {r.transfer_id: r for r in rows}  # الأحدث يكسب


def _active_branches(session: Session, ids: set[str]) -> set[str]:
    if not ids:
        return set()
    return set(session.scalars(select(Branch.id).where(Branch.id.in_(ids), Branch.is_active.is_(True))).all())


def mobile_out(session: Session, user: MobileUser, rows: list[Transfer]) -> list[MobileTransferOut]:
    base = transfers_svc.to_out(session, rows)
    cmds = _latest_commands(session, [t.id for t in rows])
    active = _active_branches(session, {b for t in rows for b in (t.from_branch_id, t.to_branch_id)})
    out = []
    for t, o in zip(rows, base, strict=True):
        cmd = cmds.get(t.id)
        busy = cmd is not None and cmd.status in ACTIVE
        can_act = (
            t.status == S.REQUESTED.value and t.from_branch_id in user.branch_ids
            and t.from_branch_id in active and t.to_branch_id in active
        )  # fmt: skip
        out.append(MobileTransferOut(
            **o.model_dump(), approval=_command_out(cmd),
            can_approve=can_act and not busy,
            can_reject=can_act and not (cmd is not None and cmd.status == "executing"),
        ))  # fmt: skip
    return out


def _visible(user: MobileUser):
    allowed = list(user.branch_ids)
    return or_(Transfer.from_branch_id.in_(allowed), Transfer.to_branch_id.in_(allowed))


def mobile_list(
    session: Session, user: MobileUser, *, status: TransferStatus | None, needs_action: bool,
    branch_id: str | None, page: int, page_size: int,
) -> MobileTransferListOut:  # fmt: skip
    """تحويلات الفروع المسموحة (المرسل أو المستلم منها). needs_action = طلبات تنتظر موافقتك."""
    expire_stale(session, user.shop_id)
    conds: list[Any] = [Transfer.shop_id == user.shop_id, _visible(user)]
    if branch_id:
        user.require_branch(branch_id)
        conds.append(or_(Transfer.from_branch_id == branch_id, Transfer.to_branch_id == branch_id))
    if needs_action:
        conds += [Transfer.status == S.REQUESTED.value, Transfer.from_branch_id.in_(list(user.branch_ids))]
    elif status is not None:
        conds.append(Transfer.status == status.value)
    total = session.scalar(select(func.count()).select_from(Transfer).where(*conds)) or 0
    rows = list(
        session.scalars(
            select(Transfer).where(*conds).order_by(Transfer.number.desc())
            .offset((page - 1) * page_size).limit(page_size)
        ).all()
    )  # fmt: skip
    return MobileTransferListOut(items=mobile_out(session, user, rows), total=total)


def _get(session: Session, user: MobileUser, transfer_id: str, *, lock: bool = False) -> Transfer:
    stmt = select(Transfer).where(Transfer.id == transfer_id, Transfer.shop_id == user.shop_id)
    if lock:
        stmt = stmt.with_for_update()
    t = session.execute(stmt).scalar_one_or_none()
    # تحويل لا يخص فروعك = غير موجود بالنسبة لك (404 لا 403).
    if t is None or not ({t.from_branch_id, t.to_branch_id} & set(user.branch_ids)):
        raise NotFound("transfer_not_found", "التحويل غير موجود")
    return t


def mobile_get(session: Session, user: MobileUser, transfer_id: str) -> MobileTransferOut:
    expire_stale(session, user.shop_id)
    return mobile_out(session, user, [_get(session, user, transfer_id)])[0]


def _check_actionable(session: Session, user: MobileUser, t: Transfer, version: int) -> None:
    if t.from_branch_id not in user.branch_ids:
        raise Forbidden("transfer_not_yours", "الموافقة والرفض لمالك المحل أو مدير الفرع المطلوب منه فقط")
    if t.status != S.REQUESTED.value or t.version != version:
        current = mobile_out(session, user, [t])[0].model_dump(mode="json")
        raise Conflict(
            "transfer_changed", "تغيّرت حالة هذا الطلب من جهاز آخر. راجع الحالة الحالية قبل أي إجراء", {"transfer": current}
        )
    for bid, role in ((t.from_branch_id, "المطلوب منه"), (t.to_branch_id, "الطالب")):
        branch = session.get(Branch, bid)
        if branch is None or not branch.is_active:
            raise BadRequest("branch_disabled", f"الفرع {role} موقوف")


def _active_command(session: Session, transfer_id: str) -> TransferCommand | None:
    return session.scalars(
        select(TransferCommand).where(TransferCommand.transfer_id == transfer_id, TransferCommand.status.in_(ACTIVE))
    ).first()


# ================= الإجراءات من الهاتف =================
def mobile_approve(session: Session, user: MobileUser, transfer_id: str, data: MobileApproveIn) -> MobileTransferOut:
    expire_stale(session, user.shop_id)
    lock_shop(session, user.shop_id)
    t = _get(session, user, transfer_id, lock=True)
    _check_actionable(session, user, t, data.version)
    if _active_command(session, t.id) is not None:
        raise Conflict("approval_pending", "توجد موافقة على هذا الطلب في انتظار تنفيذ الفرع بالفعل")

    by_id = {line.id: line for line in t.lines}
    given: dict[str, int] = {}
    for item in data.lines:
        line = by_id.get(item.line_id)
        if line is None:
            raise BadRequest("transfer_line_unknown", "سطر غير موجود في الطلب", {"line_id": item.line_id})
        if item.qty > (line.qty_requested or line.qty_sent):
            raise BadRequest("transfer_over_request", f"الكمية أكبر من المطلوب في «{line.name}»")
        given[item.line_id] = item.qty
    lines: list[dict[str, Any]] = [
        {"line_id": line.id, "qty": given.get(line.id, line.qty_requested or line.qty_sent)} for line in t.lines
    ]
    if not any(entry["qty"] > 0 for entry in lines):
        raise BadRequest("transfer_empty", "لا توجد كميات للإرسال. استخدم الرفض بدلاً من ذلك")

    cmd = TransferCommand(
        id=str(uuid.uuid4()), shop_id=user.shop_id, transfer_id=t.id, branch_id=t.from_branch_id, action="approve",
        body={"lines": lines, "note": data.note}, transfer_version=t.version, status="pending",
        requested_by=user.username, account_id=user.account_id, session_id=user.session_id,
        device_name=user.device_name, created_at=utcnow(),
    )  # fmt: skip
    session.add(cmd)
    record(
        session, "transfer_approve_requested", actor="mobile", shop_id=user.shop_id, branch_id=t.from_branch_id,
        ip=user.ip, details={"transfer_id": t.id, "number": t.number, "command_id": cmd.id, "device": user.device_name,
                             "lines": sum(1 for e in lines if e["qty"] > 0), **_via(user)},
    )  # fmt: skip
    session.commit()
    return mobile_out(session, user, [t])[0]


def mobile_reject(session: Session, user: MobileUser, transfer_id: str, data: MobileRejectIn) -> MobileTransferOut:
    """الرفض لا يحرّك مخزوناً: يتم على السيرفر مباشرة بنفس مسار رفض البرنامج (الحدث يصل للفرع الطالب)."""
    expire_stale(session, user.shop_id)
    lock_shop(session, user.shop_id)
    t = _get(session, user, transfer_id, lock=True)
    _check_actionable(session, user, t, data.version)
    cmd = _active_command(session, t.id)
    if cmd is not None and cmd.status == "executing":
        raise Conflict("approval_in_progress", "الفرع ينفّذ الموافقة الآن. انتظر النتيجة")
    branch = session.get(Branch, t.from_branch_id)
    caller = Caller(branch_id=t.from_branch_id, shop_id=user.shop_id, branch_name=branch.name if branch else "",
                    token_exp=utcnow(), ip=user.ip)  # fmt: skip
    transfers_svc.reject(
        session, caller, t.id, RejectIn(reason=data.reason), via={**_via(user), "device": user.device_name}
    )
    return mobile_get(session, user, t.id)


def mobile_cancel_approval(session: Session, user: MobileUser, transfer_id: str) -> MobileTransferOut:
    lock_shop(session, user.shop_id)
    t = _get(session, user, transfer_id, lock=True)
    cmd = _active_command(session, t.id)
    if cmd is None:
        raise Conflict("no_pending_approval", "لا توجد موافقة معلّقة على هذا الطلب")
    if cmd.status == "executing":
        raise Conflict("approval_in_progress", "الفرع ينفّذ الموافقة الآن ولا يمكن إلغاؤها")
    if cmd.account_id != user.account_id and user.role != "owner":
        raise Forbidden("approval_not_yours", "يلغي الموافقة صاحبها أو مالك المحل فقط")
    _finish(session, cmd, "cancelled", f"ألغاها {user.username} من الهاتف")
    session.commit()
    return mobile_out(session, user, [t])[0]


# ================= جهاز الفرع: يأخذ الأوامر وينفّذها =================
def _branch_out(cmd: TransferCommand) -> BranchCommandOut:
    return BranchCommandOut(
        id=cmd.id, transfer_id=cmd.transfer_id, action=cmd.action, lines=cmd.body.get("lines") or [],
        note=cmd.body.get("note"), requested_by=cmd.requested_by, device_name=cmd.device_name,
        created_at=_aware(cmd.created_at),  # type: ignore[arg-type]
    )  # fmt: skip


def branch_pending(session: Session, caller: Caller) -> list[BranchCommandOut]:
    expire_stale(session, caller.shop_id)
    rows = session.scalars(
        select(TransferCommand)
        .where(TransferCommand.branch_id == caller.branch_id, TransferCommand.status == "pending")
        .order_by(TransferCommand.created_at)
    ).all()
    return [_branch_out(r) for r in rows]


def _branch_command(session: Session, caller: Caller, command_id: str) -> TransferCommand:
    cmd = session.execute(
        select(TransferCommand).where(TransferCommand.id == command_id).with_for_update()
    ).scalar_one_or_none()
    if cmd is None or cmd.shop_id != caller.shop_id or cmd.branch_id != caller.branch_id:
        raise NotFound("command_not_found", "الأمر غير موجود")
    return cmd


def branch_claim(session: Session, caller: Caller, command_id: str) -> BranchCommandOut:
    """الفرع يستلم الأمر قبل التنفيذ (مرة واحدة): يمنع التنفيذ المزدوج."""
    expire_stale(session, caller.shop_id)
    lock_shop(session, caller.shop_id)
    cmd = _branch_command(session, caller, command_id)
    if cmd.status != "pending":
        raise Conflict("command_not_pending", "الأمر لم يعد في الانتظار", {"status": cmd.status})
    t = session.get(Transfer, cmd.transfer_id)
    if t is None or t.status != S.REQUESTED.value or t.version != cmd.transfer_version:
        _finish(session, cmd, "superseded", "تغيّر الطلب قبل أن ينفّذه الفرع")
        session.commit()
        raise Conflict("command_stale", "تغيّر الطلب قبل التنفيذ", {"status": "superseded"})
    cmd.status = "executing"
    cmd.claimed_at = utcnow()
    record(session, "transfer_command_claimed", actor="branch", shop_id=caller.shop_id, branch_id=caller.branch_id,
           ip=caller.ip, details={"transfer_id": cmd.transfer_id, "command_id": cmd.id, "from_phone": True,
                                  "username": cmd.requested_by})  # fmt: skip
    session.commit()
    return _branch_out(cmd)


def branch_fail(session: Session, caller: Caller, command_id: str, data: CommandFailIn) -> dict[str, str]:
    """الفرع لم يقدر ينفّذ (مخزون غير كافٍ، صنف غير معروف…): السبب يظهر في الهاتف."""
    lock_shop(session, caller.shop_id)
    cmd = _branch_command(session, caller, command_id)
    if cmd.status in ACTIVE:
        _finish(session, cmd, "failed", data.message, data.code)
        session.commit()
    return {"status": cmd.status}
