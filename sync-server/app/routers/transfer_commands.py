"""أوامر الهاتف لجهاز الفرع (موافقة على طلب تحويل). الفرع يسحبها مع مزامنته الدورية ويستلمها ثم ينفّذها بنفس
مسار الموافقة في البرنامج (POST /v1/transfers/{id}/approve)، فيُحسم الأمر تلقائياً «done».

  GET  /v1/transfers/commands                أوامر هذا الفرع المنتظرة
  POST /v1/transfers/commands/{id}/claim     استلام قبل التنفيذ (مرة واحدة)
  POST /v1/transfers/commands/{id}/fail      تعذّر التنفيذ (السبب يظهر في الهاتف)

فرع بإصدار أقدم لا يستدعي هذه المسارات أصلاً: أوامره تنتهي بعد المهلة ولا يتأثر أي شيء عنده.
مُسجَّل قبل router التحويلات حتى لا يُفهم «commands» كمعرّف تحويل.
"""

from fastapi import APIRouter

from ..db import SessionDep
from ..schemas import BranchCommandOut, CommandFailIn
from ..security import CallerDep
from ..services import transfer_commands as svc

router = APIRouter(prefix="/transfers/commands", tags=["transfers"])


@router.get("", response_model=list[BranchCommandOut])
def pending(caller: CallerDep, session: SessionDep):
    return svc.branch_pending(session, caller)


@router.post("/{command_id}/claim", response_model=BranchCommandOut)
def claim(command_id: str, caller: CallerDep, session: SessionDep):
    return svc.branch_claim(session, caller, command_id)


@router.post("/{command_id}/fail")
def fail(command_id: str, data: CommandFailIn, caller: CallerDep, session: SessionDep) -> dict[str, str]:
    return svc.branch_fail(session, caller, command_id, data)
