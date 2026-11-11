"""النسخ الاحتياطي: الحالة لأي مستخدم (لشريط الحالة)، والإنشاء والقائمة والمكان والاستعادة للمدير."""

from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select

from app.core.audit import record_audit
from app.core.caller import CallerDep, require_main_device
from app.core.base import uuid7
from app.core.database import get_sessionmaker
from app.core.deps import ActorDep, SessionDep
from app.core.init_db import init_db
from app.core.outbox import OutboxEvent, OutboxStatus
from app.core.plan import Feature, ensure_feature
from app.core.permissions import require_authenticated, require_manager, require_manager_write
from app.core.security import Role
from app.modules.settings.schema import BackupLocationIn
from app.modules.settings.service import SettingsService

from .service import (
    AUTO_BACKUP_HOURS,
    KEEP_BACKUPS,
    create_backup,
    current_location,
    default_backup_dir,
    ensure_writable,
    list_backups,
    resolve_backup,
    restore_backup,
)

router = APIRouter(prefix="/backup", tags=["backup"])


class BackupOut(BaseModel):
    name: str
    size: int
    created_at: datetime


class BackupLocationOut(BaseModel):
    path: str  # المجلد المستخدم فعلاً الآن
    default_path: str
    is_default: bool
    # المدير حدّد مجلداً غير متاح الآن (فلاشة مفصولة)، والنسخ تُكتب مؤقتاً في الافتراضي.
    fallback: bool
    configured: str | None


class BackupStatusOut(BaseModel):
    last_backup_at: datetime | None
    count: int
    pending_sync: int  # تغييرات لم تُرفع بعد للسحابة
    auto_every_hours: int
    keep: int
    location: BackupLocationOut | None  # للمدير فقط


class RestoreIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None  # نسخة من القائمة
    path: str | None = None  # أو ملف من مكان آخر (فلاشة)


class RestoreOut(BaseModel):
    safety_backup: str  # نسخة الوضع السابق، للتراجع عن الاستعادة لو لزم


def _location_out() -> BackupLocationOut:
    loc = current_location()
    return BackupLocationOut(
        path=str(loc.path),
        default_path=str(default_backup_dir()),
        is_default=loc.is_default,
        fallback=loc.fallback,
        configured=loc.configured,
    )


def _out(f) -> BackupOut:  # noqa: ANN001
    return BackupOut(name=f.name, size=f.size, created_at=f.created_at)


@router.get("/status", response_model=BackupStatusOut, dependencies=[Depends(require_authenticated)])
def backup_status(session: SessionDep, actor: ActorDep, caller: CallerDep):
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
        # المجلد على قرص الجهاز الأساسي: يُعرض للمدير على الجهاز الأساسي فقط.
        location=_location_out() if actor.role is Role.MANAGER and caller.is_main else None,
    )


@router.get("", response_model=list[BackupOut], dependencies=[Depends(require_manager)])
def get_backups():
    return [_out(f) for f in list_backups()]


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
    return _out(created)


@router.put(
    "/location",
    response_model=BackupLocationOut,
    dependencies=[Depends(require_manager_write), Depends(require_main_device)],
)
def set_location(data: BackupLocationIn, session: SessionDep, actor: ActorDep):
    """يحفظ المجلد بعد التأكد أنه قابل للكتابة، ثم يأخذ نسخة فيه فوراً."""
    ensure_feature(Feature.BACKUP_LOCATION)  # بَسطة: المجلد الافتراضي فقط
    path = str(ensure_writable(data.path)) if data.path else None
    if path and ensure_writable(path) == default_backup_dir():
        path = None  # اختيار المجلد الافتراضي نفسه = الافتراضي
    SettingsService(session).set_backup_dir(actor, path)
    session.commit()
    create_backup()  # أول نسخة في المكان الجديد، حتى لا يبقى فارغاً
    return _location_out()


@router.post(
    "/restore",
    response_model=RestoreOut,
    dependencies=[Depends(require_manager_write), Depends(require_main_device)],
)
def restore(data: RestoreIn, session: SessionDep, actor: ActorDep):
    """يستبدل كل البيانات بالنسخة المختارة. الجلسات الحالية قد تنتهي فيُعاد تسجيل الدخول."""
    if data.path:  # بَسطة: الاستعادة من نسخ هذا الجهاز فقط (لا من فلاشة/ملف خارجي)
        ensure_feature(Feature.BACKUP_LOCATION)
    source = resolve_backup(data.name, data.path)
    session.close()  # نحرر اتصال هذا الطلب قبل الكتابة على القاعدة كلها
    safety = restore_backup(source)
    init_db()  # نسخة أقدم قد تنقصها جداول أُضيفت لاحقاً
    with get_sessionmaker()() as fresh:
        record_audit(
            fresh, actor, entity="backup", entity_id=uuid7(), action="restore",
            changes={"source": source.name, "safety_backup": safety.name},
        )  # fmt: skip
        fresh.commit()
    return RestoreOut(safety_backup=safety.name)
