"""حماية مسارات المصروفات بالأدوار.

- require_admin: أدمن فقط (القراءة).
- require_admin_write: أدمن + تصريح كتابة ساري (الترخيص غير منتهٍ).

لو عايز الكاشير يسجّل مصاريف: أضف require_cashier هنا وغيّر dependency المسار المعني.
"""

from typing import Annotated

from fastapi import Depends

from app.core.errors import ForbiddenError
from app.core.security import Actor, Role, get_actor, require_write_permit


def require_admin(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    if actor.role is not Role.MANAGER:
        raise ForbiddenError("forbidden", "هذه العملية للمدير فقط")
    return actor


def require_admin_write(
    actor: Annotated[Actor, Depends(require_admin)],
    _permit: Annotated[None, Depends(require_write_permit)],
) -> Actor:
    return actor