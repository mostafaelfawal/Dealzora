"""Enums الداخلية (لا علاقة لها بـ HTTP)."""

from enum import StrEnum


class AuditAction(StrEnum):
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_CHANGE_FAILED = "password_change_failed"
