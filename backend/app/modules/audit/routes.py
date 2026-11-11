"""سجل العمليات (قراءة فقط، للمدير). الجدول نفسه في core/audit.py ويُكتب من كل الموديولات."""

from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select

from app.core.audit import AuditLog
from app.core.deps import SessionDep
from app.core.lookups import user_names
from app.core.pagination import Page, PageQuery, make_page
from app.core.periods import day_bounds_utc
from app.core.permissions import require_manager
from app.core.repository import fetch_page

from .describe import ACTION_LABELS, DANGER_ACTIONS, ENTITY_LABELS, describe_rows

router = APIRouter(prefix="/audit-log", tags=["audit"], dependencies=[Depends(require_manager)])

MAX_ENTITY_LEN = 40


class AuditQuery(PageQuery):
    model_config = ConfigDict(extra="forbid")

    entity: str | None = Field(None, max_length=MAX_ENTITY_LEN)
    action: str | None = Field(None, max_length=MAX_ENTITY_LEN)
    actor_id: str | None = Field(None, max_length=36)
    entity_id: str | None = Field(None, max_length=36)
    date_from: date | None = None
    date_to: date | None = None

    @model_validator(mode="after")
    def _range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        return self


class AuditDetailOut(BaseModel):
    label: str
    before: str | None  # None = قيمة واحدة (إضافة/حذف)، وإلا «قبل ← بعد»
    after: str


class AuditOut(BaseModel):
    id: str
    entity: str
    entity_label: str
    entity_id: str
    action: str
    action_label: str
    actor_id: str
    actor_name: str | None
    # جملة عربية مقروءة («عدّل الصنف «سكر»») + التفاصيل بالأسماء والعملة والكميات.
    summary: str
    details: list[AuditDetailOut]
    danger: bool  # حذف، مرتجع، تعديل مخزون، دخول فاشل...
    changes: dict[str, Any] | None  # الخام كما هو (للدعم الفني)
    created_at: datetime


class OptionOut(BaseModel):
    value: str
    label: str


class AuditFiltersOut(BaseModel):
    entities: list[OptionOut]
    actions: list[OptionOut]


class ActorOut(BaseModel):
    id: str
    name: str


@router.get("", response_model=Page[AuditOut])
def list_audit(session: SessionDep, query: Annotated[AuditQuery, Query()]):
    conds = []
    if query.entity:
        conds.append(AuditLog.entity == query.entity)
    if query.action:
        conds.append(AuditLog.action == query.action)
    if query.actor_id:
        conds.append(AuditLog.actor_id == query.actor_id)
    if query.entity_id:
        conds.append(AuditLog.entity_id == query.entity_id)
    if query.date_from or query.date_to:
        start, end = day_bounds_utc(
            query.date_from or date(2000, 1, 1), query.date_to or date(2999, 12, 31)
        )
        conds += [AuditLog.created_at >= start, AuditLog.created_at < end]
    rows, total = fetch_page(
        session, AuditLog, conds, [AuditLog.id.desc()], query.page, query.page_size
    )
    names = user_names(session, [r.actor_id for r in rows])
    described = describe_rows(session, list(rows))
    items = [
        AuditOut(
            id=r.id,
            entity=r.entity,
            entity_label=ENTITY_LABELS.get(r.entity, r.entity),
            entity_id=r.entity_id,
            action=r.action,
            action_label=ACTION_LABELS.get(r.action, r.action),
            actor_id=r.actor_id,
            actor_name=names.get(r.actor_id),
            summary=d.summary,
            details=[AuditDetailOut(label=x.label, before=x.before, after=x.after) for x in d.details],
            danger=r.action in DANGER_ACTIONS,
            changes=r.changes,
            created_at=r.created_at,
        )
        for r, d in zip(rows, described, strict=True)
    ]
    return make_page(items, total, query)


@router.get("/filters", response_model=AuditFiltersOut)
def list_filters(session: SessionDep):
    """الأنواع والعمليات الموجودة فعلاً في السجل، بأسمائها العربية (لقوائم الفلترة)."""
    entities = session.scalars(select(AuditLog.entity).distinct()).all()
    actions = session.scalars(select(AuditLog.action).distinct()).all()

    def opts(values, labels):  # noqa: ANN001, ANN202
        return sorted(
            (OptionOut(value=v, label=labels.get(v, v)) for v in values), key=lambda o: o.label
        )

    return AuditFiltersOut(entities=opts(entities, ENTITY_LABELS), actions=opts(actions, ACTION_LABELS))


@router.get("/actors", response_model=list[ActorOut])
def list_actors(session: SessionDep):
    """المستخدمون الذين لهم عمليات مسجّلة (لفلتر "بواسطة")."""
    ids = session.scalars(select(AuditLog.actor_id).distinct()).all()
    names = user_names(session, ids)
    return sorted(
        (ActorOut(id=uid, name=name) for uid, name in names.items()), key=lambda a: a.name
    )
