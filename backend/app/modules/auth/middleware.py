"""حماية المسارات بالأدوار (manager / cashier). تُستخدم كـ dependencies في routes.

- require_authenticated: أي مستخدم مسجّل (كاشير أو مدير).
- require_manager: مدير فقط.
- require_manager_write: مدير + تصريح كتابة ساري (الترخيص غير منتهٍ).
"""

from typing import Annotated

from fastapi import Depends, Header

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import Actor, Role, get_actor, require_write_permit


def get_token(authorization: Annotated[str | None, Header()] = None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("unauthorized", "سجّل الدخول أولاً")
    return token


def require_authenticated(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    return actor


def require_manager(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    if actor.role is not Role.MANAGER:
        raise ForbiddenError("forbidden", "هذه العملية للمدير فقط")
    return actor


def require_manager_write(
    actor: Annotated[Actor, Depends(require_manager)],
    _permit: Annotated[None, Depends(require_write_permit)],
) -> Actor:
    return actor