"""Pydantic schemas (الطلبات والاستجابات). قواعد التحقق نفسها في schema_validation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.modules.users.schema import UserOut
from app.modules.users.schema_validation import NewPassword

from .schema_validation import LoginPassword, LoginUsername


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: LoginUsername
    password: LoginPassword


class LoginOut(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut


class ChangePasswordIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: LoginPassword
    new_password: NewPassword