"""قواعد التحقق القابلة لإعادة الاستخدام (Annotated types + فحوصات عبر الحقول)."""

import re
from typing import Annotated

from pydantic import AfterValidator, Field

from app.core.passwords import MAX_PASSWORD_LEN, MIN_PASSWORD_LEN, normalize_password
from app.core.security import Role

from .constants import ASSIGNABLE_ROLES, COMMON_PASSWORDS, MAX_USERNAME_LEN, USERNAME_PATTERN
from .helper import normalize_username, password_contains_username

_USERNAME_RE = re.compile(USERNAME_PATTERN)


def _clean_username(value: str) -> str:
    value = normalize_username(value)
    if not _USERNAME_RE.fullmatch(value):
        raise ValueError("اسم المستخدم من 3 إلى 50 خانة: حروف إنجليزية صغيرة أو أرقام أو . _ -")
    return value


def _check_password(value: str) -> str:
    normalized = normalize_password(value)
    if len(normalized) < MIN_PASSWORD_LEN:
        raise ValueError(f"كلمة المرور يجب ألا تقل عن {MIN_PASSWORD_LEN} خانات")
    if not normalized.strip():
        raise ValueError("كلمة المرور لا يمكن أن تكون مسافات فقط")
    if len(set(normalized)) < 2:
        raise ValueError("كلمة المرور لا يمكن أن تكون خانة واحدة مكررة")
    if normalized.casefold() in COMMON_PASSWORDS:
        raise ValueError("كلمة المرور شائعة وسهلة التخمين")
    return value


def _assignable_role(role: Role) -> Role:
    if role not in ASSIGNABLE_ROLES:
        raise ValueError("هذا الدور لا يمكن إسناده")
    return role


Username = Annotated[str, Field(max_length=MAX_USERNAME_LEN), AfterValidator(_clean_username)]
NewPassword = Annotated[str, Field(max_length=MAX_PASSWORD_LEN), AfterValidator(_check_password)]
AssignableRole = Annotated[Role, AfterValidator(_assignable_role)]


def validate_password_vs_username(password: str, username: str) -> None:
    if password_contains_username(password, username):
        raise ValueError("كلمة المرور لا يجب أن تكون نفس اسم المستخدم")