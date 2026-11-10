"""مسارات التطوير. لا تُسجَّل أصلاً في الـ router إلا مع POS_DEBUG=true (انظر api/router.py)،
وكل مسار يتحقق من ذلك مرة أخرى احتياطاً. للمدير فقط، والكتابة بتصريح كتابة.
"""

from fastapi import APIRouter, Depends

from app.core.deps import service_dependency
from app.core.permissions import require_manager, require_manager_write

from .service import DemoClearOut, DemoSeedOut, DemoService, DemoStatusOut, ensure_enabled

router = APIRouter(
    prefix="/dev/demo",
    tags=["devtools"],
    dependencies=[Depends(ensure_enabled), Depends(require_manager)],
)
Service = service_dependency(DemoService)


@router.get("", response_model=DemoStatusOut)
def demo_status(service: Service):
    return service.status()


@router.post("", response_model=DemoSeedOut, dependencies=[Depends(require_manager_write)])
def seed_demo(service: Service):
    return service.seed()


@router.delete("", response_model=DemoClearOut, dependencies=[Depends(require_manager_write)])
def clear_demo(service: Service):
    return service.clear()
