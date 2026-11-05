"""حماية المسارات بالأدوار (manager / cashier). تُستخدم كـ dependencies في routes.

- require_cashier: أي مستخدم مسجّل (الكاشير والمدير). الكاشير يحتاج العملاء لاختيارهم في البيع.
- require_admin: مدير فقط.
- require_admin_write: مدير + تصريح كتابة ساري (الترخيص غير منتهٍ).
"""

from typing import Annotated

from fastapi import Depends

from app.core.errors import ForbiddenError
from app.core.security import Actor, Role, get_actor, require_write_permit


def require_cashier(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    return actor


def require_admin(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    if actor.role is not Role.MANAGER:
        raise ForbiddenError("forbidden", "هذه العملية للمدير فقط")
    return actor


def require_admin_write(
    actor: Annotated[Actor, Depends(require_admin)],
    _permit: Annotated[None, Depends(require_write_permit)],
) -> Actor:
    return actor
