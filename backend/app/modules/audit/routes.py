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


class AuditOut(BaseModel):
    id: str
    entity: str
    entity_id: str
    action: str
    actor_id: str
    actor_name: str | None
    changes: dict[str, Any] | None
    created_at: datetime


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
    items = [
        AuditOut(
            id=r.id,
            entity=r.entity,
            entity_id=r.entity_id,
            action=r.action,
            actor_id=r.actor_id,
            actor_name=names.get(r.actor_id),
            changes=r.changes,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return make_page(items, total, query)


@router.get("/actors", response_model=list[ActorOut])
def list_actors(session: SessionDep):
    """المستخدمون الذين لهم عمليات مسجّلة (لفلتر "بواسطة")."""
    ids = session.scalars(select(AuditLog.actor_id).distinct()).all()
    names = user_names(session, ids)
    return sorted(
        (ActorOut(id=uid, name=name) for uid, name in names.items()), key=lambda a: a.name
    )
