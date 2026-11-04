"""Enums الداخلية (لا علاقة لها بـ HTTP)."""

from enum import StrEnum


class AuditAction(StrEnum):
    SETUP = "setup"
    PASSWORD_RESET = "password_reset"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"