"""تسجيل أسماء الوحدات في القائمة. تستدعيه خدمة المنتجات عند الحفظ والاستيراد،
فكل وحدة مكتوبة على صنف تظهر للمدير في إدارة الوحدات.

لا يستورد خدمة المنتجات (تفادياً للاستيراد الدائري).
"""

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.outbox import OutboxOp, enqueue_outbox
from app.core.security import Actor
from app.core.snapshots import take_snapshot
from app.modules.products.model import Product, ProductUnit

from .constants import DEFAULT_UNITS, ENTITY_MEASURE_UNIT, UNIT_SNAPSHOT_FIELDS
from .model import MeasureUnit


def enqueue_unit(
    session: Session,
    actor: Actor,
    unit: MeasureUnit,
    *,
    base_version: int | None,
    op: OutboxOp = OutboxOp.UPSERT,
) -> None:
    enqueue_outbox(
        session,
        entity=ENTITY_MEASURE_UNIT,
        entity_id=unit.id,
        op=op,
        payload={
            "id": unit.id,
            "version": unit.version,
            "deleted_at": unit.deleted_at.isoformat() if unit.deleted_at else None,
            **take_snapshot(unit, UNIT_SNAPSHOT_FIELDS),
        },
        base_version=base_version,
        device_id=actor.device_id,
    )


def _add(session: Session, actor: Actor, name: str, allow_decimal: bool, order: int) -> MeasureUnit:
    unit = MeasureUnit(
        id=uuid7(),
        name=name,
        allow_decimal=allow_decimal,
        sort_order=order,
        device_id=actor.device_id,
        created_by=actor.user_id,
    )
    session.add(unit)
    enqueue_unit(session, actor, unit, base_version=None)
    return unit


def seed_units_if_empty(session: Session, actor: Actor) -> bool:
    """أول مرة فقط (الجدول فارغ تماماً حتى من المحذوف): الوحدات الافتراضية
    + أي وحدة مكتوبة على أصناف موجودة قبل إضافة هذه الميزة. لا commit هنا."""
    if session.scalar(select(func.count()).select_from(MeasureUnit)):
        return False
    names: dict[str, bool] = dict(DEFAULT_UNITS)
    used = session.scalars(
        select(Product.unit).where(Product.deleted_at.is_(None)).union(
            select(ProductUnit.name).where(ProductUnit.deleted_at.is_(None))
        )
    ).all()
    for name in used:
        names.setdefault(name, False)
    for order, (name, allow_decimal) in enumerate(names.items()):
        _add(session, actor, name, allow_decimal, order)
    session.flush()
    return True


def ensure_units(session: Session, actor: Actor, names: Iterable[str]) -> dict[str, bool]:
    """يضيف الأسماء الناقصة للقائمة ويرجع {الاسم: يقبل كسوراً}. لا commit هنا."""
    seed_units_if_empty(session, actor)
    wanted = {n for n in names if n}
    if not wanted:
        return {}
    rows = session.scalars(
        select(MeasureUnit).where(MeasureUnit.name.in_(wanted), MeasureUnit.deleted_at.is_(None))
    ).all()
    found = {u.name: u.allow_decimal for u in rows}
    missing = wanted - found.keys()
    if missing:
        last = session.scalar(select(func.max(MeasureUnit.sort_order))) or 0
        for i, name in enumerate(sorted(missing), start=1):
            _add(session, actor, name, False, last + i)
            found[name] = False
        session.flush()
    return found
