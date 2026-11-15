"""ملخصات جديدة من الفروع (المرحلة 7) وعرضها في تطبيق الهاتف.

الفرع (backend) يحسبها في الخلفية مع مزامنته من جداول موجودة (لا شيء في مسار البيع)، ويرفع ما تغيّر فقط:
  لقطات حالية تُستبدل:  shortages (تحت حد الطلب)، expiring (قريب الانتهاء)، wanted_stock (انظر أدناه)
  سجلات بمفتاح ثابت:    shift (إغلاق وردية بفرق النقدية)، sensitive (خصم/مرتجع فوق حد المالك، مرتجع فاتورة كاملة)،
                        top (الأكثر مبيعاً ليوم)

الفائض بدون إرسال المخزون كاملاً: السيرفر يعطي كل فرع قائمة الأصناف الناقصة في الفروع الأخرى (wanted)،
والفرع يرفع مخزونه منها فقط. فائض الفرع = مخزونه − حد الطلب عنده.

التوافق: فرع قديم لا يرفع شيئاً (الشاشات تقول «لم يرسل بعد»)، وسيرفر قديم يرد 404 فيتوقف الفرع عن المحاولة مؤقتاً.
"""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record
from ..db import utcnow
from ..errors import BadRequest, Forbidden, NotFound
from ..mobile_security import MobileUser
from ..models import Branch, BranchRecord, BranchReport, ShopReportConfig
from ..schemas import (
    BranchExpiringOut,
    BranchShortagesOut,
    ExpiringOut,
    MobileTransferOut,
    MobileTransferRequestIn,
    RecordOut,
    ReportConfigBody,
    ReportsConfigOut,
    ReportsPushIn,
    RequestLineIn,
    SensitiveRecordData,
    ShiftRecordData,
    ShortageOut,
    SuggestionOut,
    TopRecordData,
    TopSellerOut,
    TransferRequestIn,
)
from ..security import Caller
from . import transfer_commands, transfers
from .mobile_reports import check_range

SNAPSHOTS = ("shortages", "expiring", "wanted_stock")
RECORD_MODELS: dict[str, type[BaseModel]] = {"shift": ShiftRecordData, "sensitive": SensitiveRecordData, "top": TopRecordData}
MAX_WANTED = 300


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


# ================= حدود المالك =================
def get_config(session: Session, shop_id: str) -> dict[str, Any]:
    row = session.get(ShopReportConfig, shop_id)
    base = ReportConfigBody.model_validate({}).model_dump()
    if row is not None:
        try:
            base = ReportConfigBody.model_validate({**base, **(row.data or {})}).model_dump()
        except ValidationError:
            pass
    return base


def put_config(session: Session, user: MobileUser, data: ReportConfigBody) -> dict[str, Any]:
    if user.role != "owner":
        raise Forbidden("owner_only", "هذه الإعدادات لمالك المحل فقط")
    row = session.get(ShopReportConfig, user.shop_id)
    if row is None:
        row = ShopReportConfig(shop_id=user.shop_id, data={})
        session.add(row)
    row.data = data.model_dump()
    row.updated_at = utcnow()
    record(session, "report_config_updated", actor="mobile", shop_id=user.shop_id, ip=user.ip,
           details={"from_phone": True, "username": user.username, "device": user.device_name, **row.data})  # fmt: skip
    session.commit()
    return get_config(session, user.shop_id)


# ================= من جهاز الفرع =================
def _snapshot(session: Session, branch_id: str, kind: str) -> BranchReport | None:
    return session.get(BranchReport, (branch_id, kind))


def branch_config(session: Session, caller: Caller) -> ReportsConfigOut:
    """الحدود + الأصناف الناقصة في الفروع الأخرى النشطة (ليرفع الفرع مخزونه منها فقط)."""
    others = session.scalars(
        select(BranchReport).join(Branch, Branch.id == BranchReport.branch_id).where(
            BranchReport.shop_id == caller.shop_id, BranchReport.kind == "shortages",
            BranchReport.branch_id != caller.branch_id, Branch.is_active.is_(True),
        )
    ).all()  # fmt: skip
    wanted: list[str] = []
    for row in others:
        for item in row.data or []:
            key = item.get("key")
            if key and key not in wanted:
                wanted.append(key)
    return ReportsConfigOut(**get_config(session, caller.shop_id), wanted=wanted[:MAX_WANTED])


def ingest(session: Session, caller: Caller, data: ReportsPushIn) -> dict[str, int]:
    now = utcnow()
    for kind in SNAPSHOTS:
        items = getattr(data, kind)
        if items is None:
            continue
        row = _snapshot(session, caller.branch_id, kind)
        if row is None:
            row = BranchReport(branch_id=caller.branch_id, kind=kind, shop_id=caller.shop_id, data=[])
            session.add(row)
        row.data = [i.model_dump(mode="json") for i in items]
        row.updated_at = now
    saved = 0
    for rec in data.records:
        try:
            payload = RECORD_MODELS[rec.kind].model_validate(rec.data).model_dump(mode="json")
        except ValidationError as exc:
            raise BadRequest("report_invalid", "بيانات ملخص غير صالحة", {"key": rec.key}) from exc
        rec_row = session.scalars(
            select(BranchRecord).where(BranchRecord.branch_id == caller.branch_id, BranchRecord.key == rec.key)
        ).first()
        if rec_row is None:
            rec_row = BranchRecord(id=str(uuid.uuid4()), shop_id=caller.shop_id, branch_id=caller.branch_id,
                                   key=rec.key, kind=rec.kind, created_at=now)  # fmt: skip
            session.add(rec_row)
        rec_row.day, rec_row.at, rec_row.data, rec_row.updated_at = rec.day, rec.at, payload, now
        saved += 1
    session.commit()
    return {"records": saved}


# ================= للهاتف =================
def _branches(session: Session, user: MobileUser, branch_id: str | None) -> list[Branch]:
    ids = list(user.branch_ids)
    if branch_id is not None:
        user.require_branch(branch_id)
        ids = [branch_id]
    return list(session.scalars(select(Branch).where(Branch.shop_id == user.shop_id, Branch.id.in_(ids))
                                .order_by(Branch.created_at)).all())  # fmt: skip


def shortages(session: Session, user: MobileUser, branch_id: str | None) -> list[BranchShortagesOut]:
    """نواقص الفروع المسموحة، ولكل صنف الفروع التي فيها فائض منه (من أي فرع نشط في المحل)."""
    mine = _branches(session, user, branch_id)
    all_branches = {b.id: b for b in session.scalars(select(Branch).where(Branch.shop_id == user.shop_id)).all()}
    surplus: dict[str, list[tuple[str, int]]] = {}
    for row in session.scalars(
        select(BranchReport).where(BranchReport.shop_id == user.shop_id, BranchReport.kind == "wanted_stock")
    ).all():
        b = all_branches.get(row.branch_id)
        if b is None or not b.is_active:
            continue
        for item in row.data or []:
            extra = int(item.get("qty") or 0) - max(int(item.get("min") or 0), 0)
            if extra > 0:
                surplus.setdefault(item["key"], []).append((row.branch_id, extra))
    out = []
    for b in mine:
        snap = _snapshot(session, b.id, "shortages")
        items = []
        for it in (snap.data if snap else []) or []:
            sugg = sorted(
                (s for s in surplus.get(it["key"], []) if s[0] != b.id), key=lambda s: s[1], reverse=True
            )[:3]
            items.append(ShortageOut(
                **{k: it.get(k) for k in ("key", "product_id", "barcode", "name", "unit", "qty", "min")},
                need=max(int(it.get("min") or 0) - int(it.get("qty") or 0), 0),
                suggestions=[SuggestionOut(branch_id=bid, branch_name=all_branches[bid].name, surplus=qty) for bid, qty in sugg],
            ))  # fmt: skip
        out.append(BranchShortagesOut(branch_id=b.id, branch_name=b.name, updated_at=_aware(snap.updated_at) if snap else None,
                                      items=items))  # fmt: skip
    return out


def expiring(session: Session, user: MobileUser, branch_id: str | None) -> list[BranchExpiringOut]:
    out = []
    for b in _branches(session, user, branch_id):
        snap = _snapshot(session, b.id, "expiring")
        items = sorted((ExpiringOut(**{k: it.get(k) for k in ("key", "name", "unit", "batch_no", "expiry", "qty")})
                        for it in (snap.data if snap else []) or []), key=lambda i: i.expiry)  # fmt: skip
        out.append(BranchExpiringOut(branch_id=b.id, branch_name=b.name, items=items,
                                     updated_at=_aware(snap.updated_at) if snap else None))  # fmt: skip
    return out


def records(session: Session, user: MobileUser, kind: str, d1: date, d2: date, branch_id: str | None) -> list[RecordOut]:
    check_range(d1, d2)
    branches = {b.id: b.name for b in _branches(session, user, branch_id)}
    rows = session.scalars(
        select(BranchRecord).where(
            BranchRecord.shop_id == user.shop_id, BranchRecord.kind == kind,
            BranchRecord.branch_id.in_(list(branches)), BranchRecord.day.between(d1, d2),
        ).order_by(BranchRecord.at.desc(), BranchRecord.updated_at.desc()).limit(500)
    ).all()  # fmt: skip
    return [RecordOut(id=r.id, branch_id=r.branch_id, branch_name=branches[r.branch_id], day=r.day, at=_aware(r.at),
                      data=r.data, received_at=_aware(r.updated_at)) for r in rows]  # type: ignore[arg-type]  # fmt: skip


def top_sellers(session: Session, user: MobileUser, d1: date, d2: date, branch_id: str | None) -> list[TopSellerOut]:
    """مجموع قوائم «الأكثر مبيعاً» اليومية (أعلى 20 لكل فرع يومياً) للفترة، مرتبة بالإيراد."""
    totals: dict[str, dict[str, Any]] = {}
    for r in records(session, user, "top", d1, d2, branch_id):
        for it in r.data.get("items") or []:
            t = totals.setdefault(it["key"], {"key": it["key"], "name": it["name"], "unit": it["unit"], "qty": 0,
                                              "revenue": 0, "branches": set()})  # fmt: skip
            t["qty"] += int(it.get("qty") or 0)
            t["revenue"] += int(it.get("revenue") or 0)
            t["branches"].add(r.branch_id)
    ranked = sorted(totals.values(), key=lambda t: t["revenue"], reverse=True)[:30]
    return [TopSellerOut(**{**t, "branches": len(t["branches"])}) for t in ranked]


def request_transfer(session: Session, user: MobileUser, data: MobileTransferRequestIn) -> MobileTransferOut:
    """طلب تحويل باسم الفرع الناقص بنفس مسار طلب البرنامج (لا مخزون يتحرك حتى يوافق الفرع الآخر).
    الصلاحية = البرنامج: يطلب الفرع لنفسه ← المالك أو مدير الفرع الناقص."""
    user.require_branch(data.to_branch_id)
    if data.from_branch_id == data.to_branch_id:
        raise BadRequest("transfer_same_branch", "لا يمكن التحويل لنفس الفرع")
    snap = _snapshot(session, data.to_branch_id, "shortages")
    by_key = {it["key"]: it for it in (snap.data if snap else []) or []}
    lines = []
    for ln in data.lines:
        it = by_key.get(ln.key)
        if it is None:
            raise BadRequest("shortage_unknown", "الصنف لم يعد ضمن نواقص الفرع. حدّث الشاشة")
        lines.append(RequestLineIn(product_id=it["product_id"], barcode=it.get("barcode"), name=it["name"],
                                   unit=it["unit"], qty=ln.qty))  # fmt: skip
    to_branch = session.get(Branch, data.to_branch_id)
    if to_branch is None or to_branch.shop_id != user.shop_id or not to_branch.is_active:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    caller = Caller(branch_id=to_branch.id, shop_id=user.shop_id, branch_name=to_branch.name, token_exp=utcnow(), ip=user.ip)
    out = transfers.request(
        session, caller,
        TransferRequestIn(id=str(uuid.uuid4()), from_branch_id=data.from_branch_id, lines=lines, note=data.note,
                          requested_by=f"{user.username} (من الهاتف)"),
        via={"from_phone": True, "username": user.username, "session_id": user.session_id, "device": user.device_name},
    )  # fmt: skip
    return transfer_commands.mobile_get(session, user, out.id)
