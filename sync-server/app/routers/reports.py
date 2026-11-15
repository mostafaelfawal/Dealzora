"""ملخصات الفروع الجديدة (المرحلة 7): الفرع يأخذ الحدود والأصناف المطلوبة، ويرفع ما تغيّر.

  GET  /v1/reports/config   حدود المالك + الأصناف الناقصة في الفروع الأخرى (wanted)
  POST /v1/reports/push     لقطات (نواقص/صلاحية/مخزون المطلوب) + سجلات (ورديات/حساسة/الأكثر مبيعاً)

فرع بإصدار أقدم لا يستدعيها، وسيرفر أقدم يرد 404 فيتجاهلها الفرع مؤقتاً.
"""

from fastapi import APIRouter

from ..db import SessionDep
from ..schemas import ReportsConfigOut, ReportsPushIn
from ..security import CallerDep
from ..services import branch_reports

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/config", response_model=ReportsConfigOut)
def config(caller: CallerDep, session: SessionDep):
    return branch_reports.branch_config(session, caller)


@router.post("/push")
def push(data: ReportsPushIn, caller: CallerDep, session: SessionDep) -> dict[str, int]:
    return branch_reports.ingest(session, caller, data)
