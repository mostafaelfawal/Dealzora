"""الملخص اليومي لكل فرع (مبيعات، عدد فواتير، ربح…): الفرع يرفع ملخصه، وأي فرع في المحل
(وتطبيق المالك لاحقاً) يقرأ ملخصات كل الفروع للتقارير المجمعة بدون سحب كل الأحداث."""

import json
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from ..db import SessionDep, utcnow
from ..errors import BadRequest
from ..models import DailyStat
from ..schemas import DailyStatIn, DailyStatOut
from ..security import CallerDep

router = APIRouter(prefix="/stats", tags=["stats"])
MAX_BYTES = 64_000


@router.put("/{day}", response_model=DailyStatOut)
def put_day(day: date, data: DailyStatIn, caller: CallerDep, session: SessionDep):
    if len(json.dumps(data.data, ensure_ascii=False).encode()) > MAX_BYTES:
        raise BadRequest("stats_too_large", "الملخص أكبر من الحد المسموح")
    row = session.get(DailyStat, (caller.branch_id, day))
    if row is None:
        row = DailyStat(branch_id=caller.branch_id, day=day, shop_id=caller.shop_id, data=data.data)
        session.add(row)
    else:
        row.data = data.data
    row.updated_at = utcnow()
    session.commit()
    return DailyStatOut(branch_id=row.branch_id, day=row.day, data=row.data, updated_at=row.updated_at)


@router.get("", response_model=list[DailyStatOut])
def list_days(
    caller: CallerDep,
    session: SessionDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
):
    if date_from > date_to or (date_to - date_from).days > 366:
        raise BadRequest("bad_range", "الفترة غير صالحة (حتى سنة)")
    rows = session.scalars(
        select(DailyStat)
        .where(DailyStat.shop_id == caller.shop_id, DailyStat.day.between(date_from, date_to))
        .order_by(DailyStat.day, DailyStat.branch_id)
    ).all()
    return [
        DailyStatOut(branch_id=r.branch_id, day=r.day, data=r.data, updated_at=r.updated_at)
        for r in rows
    ]
