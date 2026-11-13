"""الملخص اليومي لكل فرع (مبيعات، مرتجع، ربح، طرق الدفع، مصروفات) للتقرير المجمّع عند المالك.

- كل فرع يرفع ملخصات أيامه فقط (رفع مجمّع، ويعيد رفع آخر أيام ليغطي المرتجع والتعديل المتأخر).
- القراءة: الجهاز الرئيسي للمالك يقرأ كل فروع المحل، وأي فرع آخر يقرأ نفسه فقط
  (فرع لا يرى مبيعات وأرباح فرع آخر).
- الملخص أرقام فقط بشكل صارم (لا حقول زائدة)، والمال بالقروش.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from ..db import SessionDep, utcnow
from ..errors import BadRequest
from ..models import Branch, DailyStat
from ..schemas import DailyStatOut
from ..security import CallerDep

router = APIRouter(prefix="/stats", tags=["stats"])
MAX_DAYS_PER_PUSH = 120
_Money = Annotated[int, Field(ge=-(10**13), le=10**13)]


class DayData(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    count: int = Field(ge=0, le=10**7)
    revenue: _Money
    returns: _Money
    net: _Money
    cost: _Money
    profit: _Money
    discounts: _Money = 0
    cash: _Money = 0
    credit: _Money = 0
    wallet: _Money = 0
    expenses: _Money = 0


class DayIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day: date
    data: DayData


class OneDayIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data: DayData


class BatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: list[DayIn] = Field(min_length=1, max_length=MAX_DAYS_PER_PUSH)


def _upsert(session, caller, day: date, data: dict) -> DailyStat:  # noqa: ANN001
    row = session.get(DailyStat, (caller.branch_id, day))
    if row is None:
        row = DailyStat(branch_id=caller.branch_id, day=day, shop_id=caller.shop_id, data=data)
        session.add(row)
    else:
        row.data = data
    row.updated_at = utcnow()
    return row


@router.put("/{day}", response_model=DailyStatOut)
def put_day(day: date, data: OneDayIn, caller: CallerDep, session: SessionDep):
    row = _upsert(session, caller, day, data.data.model_dump())
    session.commit()
    return DailyStatOut(branch_id=row.branch_id, day=row.day, data=row.data, updated_at=row.updated_at)


@router.post("/batch")
def put_days(data: BatchIn, caller: CallerDep, session: SessionDep):
    today = utcnow().date()
    for d in data.days:
        if d.day > today.replace(year=today.year + 1) or d.day.year < 2000:
            raise BadRequest("bad_day", "تاريخ غير صالح في الملخص")
        _upsert(session, caller, d.day, d.data.model_dump())
    session.commit()
    return {"saved": len(data.days)}


@router.get("", response_model=list[DailyStatOut])
def list_days(
    caller: CallerDep,
    session: SessionDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
):
    if date_from > date_to or (date_to - date_from).days > 366:
        raise BadRequest("bad_range", "الفترة غير صالحة (حتى سنة)")
    me = session.get(Branch, caller.branch_id)
    query = select(DailyStat).where(DailyStat.shop_id == caller.shop_id, DailyStat.day.between(date_from, date_to))
    if not (me and me.is_admin):  # فرع عادي: ملخصاته فقط
        query = query.where(DailyStat.branch_id == caller.branch_id)
    rows = session.scalars(query.order_by(DailyStat.day, DailyStat.branch_id)).all()
    return [DailyStatOut(branch_id=r.branch_id, day=r.day, data=r.data, updated_at=r.updated_at) for r in rows]
