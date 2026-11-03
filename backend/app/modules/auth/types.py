"""Enums الداخلية (لا علاقة لها بـ HTTP)."""

from enum import StrEnum


class AuditAction(StrEnum):
    SETUP = "setup"
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_CHANGE_FAILED = "password_change_failed"
    PASSWORD_RESET = "password_reset"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"