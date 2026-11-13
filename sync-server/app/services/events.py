"""سجل الأحداث: الإضافة بترتيب مضمون بلا تكرار، والسحب بالمؤشر.

الترتيب: كل إضافة تأخذ قفل صف المحل (SELECT … FOR UPDATE) ثم تزيد shops.last_seq.
فالأرقام تُحفظ بالترتيب نفسه الذي أُعطيت به: لا يظهر رقم أكبر قبل رقم أصغر، فلا يفوت
قارئاً يسحب «بعد آخر رقم». (bigserial وحده لا يضمن هذا مع المعاملات المتزامنة.)
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..errors import BadRequest, NotFound
from ..models import Branch, Event, Shop
from ..schemas import EventIn


def lock_shop(session: Session, shop_id: str) -> Shop:
    shop = session.execute(
        select(Shop).where(Shop.id == shop_id).with_for_update()
    ).scalar_one_or_none()
    if shop is None:
        raise NotFound("shop_not_found", "المحل غير موجود")
    return shop


def append_events(
    session: Session,
    *,
    shop_id: str,
    branch_id: str,
    events: list[EventIn],
    max_event_bytes: int,
) -> tuple[int, int, int]:
    """(المقبول، المكرر، آخر رقم في المحل). لا commit هنا."""
    for e in events:
        if len(json.dumps(e.payload, ensure_ascii=False).encode()) > max_event_bytes:
            raise BadRequest("event_too_large", "حدث أكبر من الحد المسموح", {"id": e.id})

    # الحدث الموجّه: لفرع من نفس المحل فقط، وليس لنفسك.
    targets = {e.target_branch_id for e in events if e.target_branch_id}
    if targets:
        valid = set(
            session.scalars(
                select(Branch.id).where(Branch.id.in_(targets), Branch.shop_id == shop_id)
            ).all()
        )
        bad = (targets - valid) | ({branch_id} & targets)
        if bad:
            raise BadRequest(
                "event_bad_target", "فرع مستهدف غير صالح في الحزمة", {"target_branch_id": sorted(bad)[0]}
            )

    shop = lock_shop(session, shop_id)
    ids = [e.id for e in events]
    existing = set(session.scalars(select(Event.id).where(Event.id.in_(ids))).all())
    seen: set[str] = set()
    accepted = duplicates = 0
    now = utcnow()
    for e in events:
        if e.id in existing or e.id in seen:
            duplicates += 1  # إعادة إرسال بعد انقطاع: نتجاهلها بأمان
            continue
        seen.add(e.id)
        shop.last_seq += 1
        session.add(
            Event(
                id=e.id,
                shop_id=shop_id,
                branch_id=branch_id,
                seq=shop.last_seq,
                entity=e.entity,
                entity_id=e.entity_id,
                op=e.op,
                payload=e.payload,
                base_version=e.base_version,
                created_at=e.created_at,
                received_at=now,
                target_branch_id=e.target_branch_id,
            )
        )
        accepted += 1
    if accepted:
        branch = session.get(Branch, branch_id)
        if branch is not None:
            branch.last_pushed_seq = shop.last_seq
    return accepted, duplicates, shop.last_seq


def append_system_event(
    session: Session, *, shop: Shop, branch_id: str, event_id: str, entity: str,
    entity_id: str, op: str, payload: dict, target_branch_id: str | None = None,
) -> None:  # fmt: skip
    """حدث يولّده السيرفر (تغيّر حالة تحويل). المستدعي أخذ قفل صف المحل بالفعل (lock_shop)."""
    shop.last_seq += 1
    session.add(
        Event(
            id=event_id,
            shop_id=shop.id,
            branch_id=branch_id,
            seq=shop.last_seq,
            entity=entity,
            entity_id=entity_id,
            op=op,
            payload=payload,
            created_at=utcnow(),
            received_at=utcnow(),
            target_branch_id=target_branch_id,
        )
    )


def pull_events(
    session: Session, *, shop_id: str, branch_id: str, after: int, limit: int, include_own: bool
) -> tuple[list[Event], int, bool]:
    """(الأحداث، next_after، has_more). نمسح بالترتيب ونتخطى أحداث الفرع نفسه والأحداث
    الموجّهة لفروع أخرى، بدون أن نقف عندها (المؤشر يتقدّم دائماً)."""
    scanned = list(
        session.scalars(
            select(Event)
            .where(Event.shop_id == shop_id, Event.seq > after)
            .order_by(Event.seq)
            .limit(limit)
        ).all()
    )
    visible = [e for e in scanned if e.target_branch_id in (None, branch_id) or e.branch_id == branch_id]
    events = visible if include_own else [e for e in visible if e.branch_id != branch_id]
    next_after = scanned[-1].seq if scanned else after
    return events, next_after, len(scanned) == limit
