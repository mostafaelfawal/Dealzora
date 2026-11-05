"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor, require_app_token
from app.modules.users.schema import UserOut

from .middleware import get_token, require_authenticated
from .schema import ChangePasswordIn, LoginIn, LoginOut
from .service import AuthService

# كل المسارات تتطلب توكن التطبيق (Rust). المسارات المحمية تتطلب فوقه جلسة مستخدم.
router = APIRouter(
    prefix="/auth", tags=["auth"], dependencies=[Depends(require_app_token)]
)


def get_public_service(
    session: Annotated[Session, Depends(get_session)],
) -> AuthService:
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
@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, service: PublicService):
    return service.login(data)


# ---------- أي مستخدم مسجّل ----------
@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_authenticated)],
)
def logout(service: Service, token: Token):
    service.logout(token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me", response_model=UserOut, dependencies=[Depends(require_authenticated)]
)
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
