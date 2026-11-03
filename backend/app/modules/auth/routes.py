"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات: الثابتة قبل /users/{user_id}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor, require_app_token

from .middleware import (
    get_token,
    require_authenticated,
    require_manager,
    require_manager_write,
)
from .schema import (
    ChangePasswordIn,
    LoginIn,
    LoginOut,
    ResetPasswordIn,
    SetupIn,
    SetupStatusOut,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .service import AuthService

# كل المسارات تتطلب توكن التطبيق (Rust). المسارات المحمية تتطلب فوقه جلسة مستخدم.
router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(require_app_token)])


def get_public_service(session: Annotated[Session, Depends(get_session)]) -> AuthService:
    return AuthService(session)


def get_auth_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> AuthService:
    return AuthService(session, actor)


PublicService = Annotated[AuthService, Depends(get_public_service)]
Service = Annotated[AuthService, Depends(get_auth_service)]
Token = Annotated[str, Depends(get_token)]


# ---------- بدون تسجيل دخول ----------
@router.get("/setup-status", response_model=SetupStatusOut)
def setup_status(service: PublicService):
    return SetupStatusOut(setup_required=service.setup_required())


@router.post("/setup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def setup_first_manager(data: SetupIn, service: PublicService):
    """يعمل فقط والنظام بلا مستخدمين."""
    return service.setup_first_manager(data)


@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, service: PublicService):
    return service.login(data)


# ---------- أي مستخدم مسجّل ----------
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_authenticated)])
def logout(service: Service, token: Token):
    service.logout(token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut, dependencies=[Depends(require_authenticated)])
def me(service: Service):
    return service.get_me()


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_authenticated)],
)
def change_password(data: ChangePasswordIn, service: Service, token: Token):
    service.change_password(token, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- قراءة: مدير ----------
@router.get("/users", response_model=list[UserOut], dependencies=[Depends(require_manager)])
def list_users(service: Service):
    return service.list_users()


# ---------- كتابة: مدير + تصريح كتابة ----------
@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager_write)],
)
def create_user(data: UserCreate, service: Service):
    return service.create_user(data)


@router.patch("/users/{user_id}", response_model=UserOut, dependencies=[Depends(require_manager_write)])
def update_user(user_id: str, data: UserUpdate, service: Service):
    return service.update_user(user_id, data)


@router.post(
    "/users/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager_write)],
)
def reset_password(user_id: str, data: ResetPasswordIn, service: Service):
    service.reset_password(user_id, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager_write)],
)
def delete_user(user_id: str, service: Service):
    service.delete_user(user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)