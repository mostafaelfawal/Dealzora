from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import User, hash_password, login, logout
from app.core.base import uuid7
from app.core.config import get_settings
from app.core.database import get_session
from app.core.errors import ConflictError
from app.core.security import Role, require_app_token

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(require_app_token)])


class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class SetupIn(LoginIn):
    password: str = Field(min_length=10, max_length=128)


@router.post("/login")
def do_login(data: LoginIn, session: Annotated[Session, Depends(get_session)]):
    token, user = login(session, data.username.strip(), data.password)
    return {"token": token, "user": {"id": user.id, "username": user.username, "role": user.role}}


@router.post("/logout", status_code=204)
def do_logout(session: Annotated[Session, Depends(get_session)], authorization: Annotated[str, Header()]):
    logout(session, authorization.partition(" ")[2])


@router.post("/setup", status_code=201)
def setup_first_admin(data: SetupIn, session: Annotated[Session, Depends(get_session)]):
    """Works ONLY while the users table is empty."""
    if (session.scalar(select(func.count()).select_from(User)) or 0) > 0:
        raise ConflictError("already_setup", "تم إعداد النظام بالفعل")
    session.add(
        User(
            id=uuid7(),
            username=data.username.strip(),
            password_hash=hash_password(data.password),
            role=Role.ADMIN.value,
            device_id=get_settings().device_id,
        )
    )
    session.commit()
    return {"ok": True}