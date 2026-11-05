"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات: الثابتة قبل /{user_id}. حرس الأدوار يأتي من auth.middleware.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor, require_app_token, require_write_permit
from app.core.permissions import require_manager, require_manager_write

from .schema import (
    ResetPasswordIn,
    SetupIn,
    SetupStatusOut,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .service import UserService

# كل المسارات تتطلب توكن التطبيق (Rust). المسارات المحمية تتطلب فوقه جلسة مستخدم.
router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_app_token)])


def get_public_service(session: Annotated[Session, Depends(get_session)]) -> UserService:
    return UserService(session)


def get_user_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> UserService:
    return UserService(session, actor)


PublicService = Annotated[UserService, Depends(get_public_service)]
Service = Annotated[UserService, Depends(get_user_service)]


# ---------- بدون تسجيل دخول ----------
@router.get("/setup-status", response_model=SetupStatusOut)
def setup_status(service: PublicService):
    return SetupStatusOut(setup_required=service.setup_required())


@router.post(
    "/setup",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_permit)]
)
def setup_first_manager(data: SetupIn, service: PublicService):
    """يعمل فقط والنظام بلا مستخدمين."""
    return service.setup_first_manager(data)


# ---------- قراءة: مدير ----------
@router.get("", response_model=list[UserOut], dependencies=[Depends(require_manager)])
def list_users(service: Service):
    return service.list_users()


# ---------- كتابة: مدير + تصريح كتابة ----------
@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager_write)],
)
def create_user(data: UserCreate, service: Service):
    return service.create_user(data)


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_manager_write)])
def update_user(user_id: str, data: UserUpdate, service: Service):
    return service.update_user(user_id, data)


@router.post(
    "/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager_write)],
)
def reset_password(user_id: str, data: ResetPasswordIn, service: Service):
    service.reset_password(user_id, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager_write)],
)
def delete_user(user_id: str, service: Service):
    service.delete_user(user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)