"""Pydantic schemas (الطلبات والاستجابات). قواعد التحقق نفسها في schema_validation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.security import Role

from .schema_validation import (
    AssignableRole,
    NewPassword,
    Username,
    validate_password_vs_username,
)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    role: Role
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime


class SetupStatusOut(BaseModel):
    setup_required: bool


# ================= الإعداد الأول =================
class SetupIn(BaseModel):
    """أول مدير في النظام (يعمل فقط والجدول فارغ)."""

    model_config = ConfigDict(extra="forbid")

    username: Username
    password: NewPassword

    @model_validator(mode="after")
    def _rules(self):
        validate_password_vs_username(self.password, self.username)
        return self


# ================= إدارة المستخدمين =================
class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Username
    password: NewPassword
    role: AssignableRole = Role.CASHIER  # أقل صلاحية افتراضياً

    @model_validator(mode="after")
    def _rules(self):
        validate_password_vs_username(self.password, self.username)
        return self


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Username | None = None
    role: AssignableRole | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _not_empty(self):
        if self.username is None and self.role is None and self.is_active is None:
            raise ValueError("لا يوجد أي تعديل")
        return self


class ResetPasswordIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_password: NewPassword