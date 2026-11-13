"""إدارة الموظفين المركزية: المالك من جهازه الرئيسي يضيف المديرين والكاشيرية ويحدد فروعهم.

- الموظف سجل في الكتالوج (kind="staff")، فيصل لأجهزة فروعه مع المزامنة العادية، وكل فرع
  يطبّق موظفيه فقط ويحذف من نُقل منه (والجلسات المفتوحة تُقفل).
- كلمة المرور لا تصل هنا أبداً: البرنامج المحلي عند المالك يجزّئها (Argon2id) ويرسل التجزئة.
- مدير نشط واحد لكل فرع، واسم المستخدم فريد على مستوى المحل (مع حساب المالك).
- الجهاز الرئيسي (is_admin) وحده يستخدم هذه الخدمة.
"""

import uuid
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record
from ..db import utcnow
from ..errors import BadRequest, Conflict, NotFound
from ..models import Branch, CatalogItem
from ..schemas import StaffIn, StaffOut, StaffPatch
from ..security import Caller
from .catalog import _conflict_message, _key_owner, _validate, match_key
from .events import lock_shop
from .self_service import _admin


def _out(row: CatalogItem) -> StaffOut:
    d = row.data
    return StaffOut(id=row.id, username=d["username"], role=d["role"], is_active=d.get("is_active", True),
                    branches=d.get("branches") or [], updated_at=row.updated_at,
                    updated_by_branch_id=row.updated_by_branch_id)  # fmt: skip


def _staff(session: Session, shop_id: str, staff_id: str) -> CatalogItem:
    row = session.get(CatalogItem, staff_id)
    if row is None or row.shop_id != shop_id or row.kind != "staff" or row.deleted:
        raise NotFound("staff_not_found", "الموظف غير موجود")
    return row


def _check_branches(session: Session, shop_id: str, branches: list[str]) -> None:
    found = set(session.scalars(select(Branch.id).where(Branch.shop_id == shop_id, Branch.id.in_(branches))).all())
    if len(set(branches)) != len(branches) or found != set(branches):
        raise BadRequest("staff_bad_branch", "فرع غير صالح في قائمة فروع الموظف")


def _check_manager_slot(session: Session, shop_id: str, data: dict[str, Any], exclude_id: str | None) -> None:
    if data["role"] != "manager" or not data.get("is_active", True):
        return
    names = dict(session.execute(select(Branch.id, Branch.name).where(Branch.shop_id == shop_id)).all())
    rows = session.scalars(
        select(CatalogItem).where(
            CatalogItem.shop_id == shop_id, CatalogItem.kind == "staff", CatalogItem.deleted.is_(False)
        )
    ).all()
    for r in rows:
        if r.id == exclude_id or r.data.get("role") != "manager" or not r.data.get("is_active", True):
            continue
        shared = set(r.data.get("branches") or []) & set(data["branches"])
        if shared:
            branch = names.get(next(iter(shared)), "")
            raise Conflict("manager_exists", f"فرع «{branch}» له مدير بالفعل ({r.data['username']}). أوقفه أو انقله أولاً")


def _save(session: Session, caller: Caller, row: CatalogItem, data: dict[str, Any], action: str) -> StaffOut:
    shop = lock_shop(session, caller.shop_id)
    shop.last_catalog_seq += 1
    row.data = data
    row.match_key = match_key("staff", data)
    row.seq = shop.last_catalog_seq
    row.updated_at = utcnow()
    row.updated_by_branch_id = caller.branch_id
    details = {"username": data["username"], "role": data["role"], "branches": len(data["branches"]),
               "is_active": data.get("is_active", True)}  # fmt: skip
    record(session, action, actor="owner", shop_id=caller.shop_id, branch_id=caller.branch_id, ip=caller.ip,
           details=details)  # fmt: skip
    session.commit()
    return _out(row)


def _valid(data: dict[str, Any]) -> dict[str, Any]:
    try:
        return _validate("staff", data)
    except ValidationError as exc:
        raise BadRequest("staff_invalid", str(exc.errors()[0].get("msg", "بيانات غير صالحة"))[:200]) from exc


def list_staff(session: Session, caller: Caller) -> list[StaffOut]:
    _admin(session, caller)
    rows = session.scalars(
        select(CatalogItem)
        .where(CatalogItem.shop_id == caller.shop_id, CatalogItem.kind == "staff", CatalogItem.deleted.is_(False))
        .order_by(CatalogItem.created_at)
    ).all()
    return [_out(r) for r in rows]


def create(session: Session, caller: Caller, data: StaffIn) -> StaffOut:
    _admin(session, caller)
    payload = _valid(data.model_dump())
    _check_branches(session, caller.shop_id, payload["branches"])
    gid = str(uuid.uuid4())
    key = match_key("staff", payload)
    if _key_owner(session, caller.shop_id, "staff", key, gid) is not None:
        raise Conflict("username_taken", _conflict_message(key or ""))
    _check_manager_slot(session, caller.shop_id, payload, None)
    row = CatalogItem(id=gid, shop_id=caller.shop_id, kind="staff", data=payload, deleted=False, version=1,
                      seq=0, created_at=utcnow())  # fmt: skip
    session.add(row)
    return _save(session, caller, row, payload, "staff_created")


def update(session: Session, caller: Caller, staff_id: str, patch: StaffPatch) -> StaffOut:
    _admin(session, caller)
    row = _staff(session, caller.shop_id, staff_id)
    payload = _valid({**row.data, **patch.model_dump(exclude_none=True)})
    _check_branches(session, caller.shop_id, payload["branches"])
    key = match_key("staff", payload)
    if _key_owner(session, caller.shop_id, "staff", key, row.id) is not None:
        raise Conflict("username_taken", _conflict_message(key or ""))
    _check_manager_slot(session, caller.shop_id, payload, row.id)
    if payload == row.data:
        return _out(row)
    row.version += 1
    return _save(session, caller, row, payload, "staff_updated")


def delete(session: Session, caller: Caller, staff_id: str) -> None:
    _admin(session, caller)
    row = _staff(session, caller.shop_id, staff_id)
    row.deleted = True
    row.version += 1
    _save(session, caller, row, row.data, "staff_deleted")
