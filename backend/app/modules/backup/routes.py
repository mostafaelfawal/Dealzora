"""النسخ الاحتياطي: الحالة لأي مستخدم (لشريط الحالة)، والإنشاء والقائمة للمدير."""

from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.deps import ActorDep, SessionDep
from app.core.outbox import OutboxEvent, OutboxStatus
from app.core.permissions import require_authenticated, require_manager, require_manager_write

from .service import AUTO_BACKUP_HOURS, KEEP_BACKUPS, create_backup, list_backups

router = APIRouter(prefix="/backup", tags=["backup"])


class BackupOut(BaseModel):
    name: str
    size: int
    created_at: datetime


class BackupStatusOut(BaseModel):
    last_backup_at: datetime | None
    count: int
    pending_sync: int  # تغييرات لم تُرفع بعد للسحابة
    auto_every_hours: int
    keep: int


@router.get("/status", response_model=BackupStatusOut, dependencies=[Depends(require_authenticated)])
def backup_status(session: SessionDep):
    files = list_backups()
    pending = session.scalar(
        select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status != OutboxStatus.DONE.value)
    )
    return BackupStatusOut(
        last_backup_at=files[0].created_at if files else None,
        count=len(files),
        pending_sync=int(pending or 0),
        auto_every_hours=AUTO_BACKUP_HOURS,
        keep=KEEP_BACKUPS,
    )


@router.get("", response_model=list[BackupOut], dependencies=[Depends(require_manager)])
def get_backups():
    return [BackupOut(name=f.name, size=f.size, created_at=f.created_at) for f in list_backups()]


@router.post(
    "",
    response_model=BackupOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager_write)],
)
def make_backup(session: SessionDep, actor: ActorDep):
    created = create_backup()
    record_audit(
        session, actor, entity="backup", entity_id=uuid7(), action="create",
        changes={"name": created.name, "size": created.size},
    )  # fmt: skip
    session.commit()
    return BackupOut(name=created.name, size=created.size, created_at=created.created_at)
