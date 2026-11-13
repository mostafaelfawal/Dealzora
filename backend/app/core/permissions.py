"""حماية المسارات بالأدوار. مصدر واحد لكل الـ modules (بدل middleware.py في كل موديول).

- require_authenticated: أي مستخدم مسجّل (كاشير أو مدير).
- require_manager: المدير أو المالك (الإدارة).
- require_owner / require_owner_write: المالك فقط (إدارة المدير، ربط الفرع، الاشتراك).
- require_manager_write: مدير + تصريح كتابة ساري (الترخيص غير منتهٍ).
- require_authenticated_write: أي مستخدم + تصريح كتابة (البيع والمرتجع وفتح/قفل الوردية).

الأسماء القديمة (cashier/admin) أبقيناها كـ aliases لتسهيل الترحيل.
"""

from typing import Annotated

from fastapi import Depends

from .errors import ForbiddenError
from .security import Actor, Role, get_actor, require_write_permit


def require_authenticated(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    return actor


def require_manager(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    if not actor.is_management:
        raise ForbiddenError("forbidden", "هذه العملية للمدير فقط")
    return actor


def require_owner(actor: Annotated[Actor, Depends(get_actor)]) -> Actor:
    if actor.role is not Role.OWNER:
        raise ForbiddenError("owner_only", "هذه العملية لمالك المحل فقط")
    return actor


def require_owner_write(
    actor: Annotated[Actor, Depends(require_owner)],
    _permit: Annotated[None, Depends(require_write_permit)],
) -> Actor:
    return actor


def require_manager_write(
    actor: Annotated[Actor, Depends(require_manager)],
    _permit: Annotated[None, Depends(require_write_permit)],
) -> Actor:
    return actor


def require_authenticated_write(
    actor: Annotated[Actor, Depends(require_authenticated)],
    _permit: Annotated[None, Depends(require_write_permit)],
) -> Actor:
    return actor


require_cashier = require_authenticated
require_cashier_write = require_authenticated_write
require_admin = require_manager
require_admin_write = require_manager_write