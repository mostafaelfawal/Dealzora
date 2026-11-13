"""كتالوج الأصناف والعملاء المشترك بين الفروع.

  POST /v1/catalog/push  {items: [{kind, gid, data, fields?, deleted?}]}  ← نتيجة لكل سجل
  GET  /v1/catalog/pull?after=<seq>&limit=  ← التغييرات بعد آخر seq (من كل الفروع)
"""

from typing import Annotated

from fastapi import APIRouter, Query

from ..config import get_settings
from ..db import SessionDep
from ..security import CallerDep
from ..services import catalog as svc

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.post("/push", response_model=list[svc.PushResult])
def push(data: svc.PushIn, caller: CallerDep, session: SessionDep):
    svc.check_size(data.items, get_settings().max_catalog_push)
    results = svc.push(session, shop_id=caller.shop_id, branch_id=caller.branch_id, items=data.items)
    session.commit()
    return results


@router.get("/pull", response_model=svc.PullOut)
def pull(
    caller: CallerDep,
    session: SessionDep,
    after: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1)] = 500,
):
    limit = min(limit, get_settings().pull_limit_max)
    return svc.pull(session, shop_id=caller.shop_id, after=after, limit=limit)
