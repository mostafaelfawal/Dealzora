"""المزامنة: رفع أحداث outbox، سحب أحداث باقي الفروع، تأكيد التطبيق، والبث (SSE).

دورة الفرع:
  1) POST /v1/sync/push  حزمة من outbox (حتى max_push_events). المكرر يُتجاهل بأمان.
  2) GET  /v1/sync/pull?after=<آخر next_after>  ← طبّق الأحداث محلياً بالترتيب.
  3) POST /v1/sync/ack {seq: next_after}  بعد التطبيق.
  4) GET  /v1/sync/stream?after=…  (اختياري) يقول «فيه جديد» فتسحب فوراً بدل الانتظار.
"""

import asyncio
import json
import time
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..config import get_settings
from ..db import SessionDep, get_sessionmaker
from ..errors import BadRequest
from ..models import Branch, Shop
from ..schemas import AckIn, EventOut, PullOut, PushIn, PushOut, SyncStatusOut
from ..security import Caller, CallerDep
from ..services.events import append_events, pull_events
from ..services.shops import branch_out

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=PushOut)
def push(data: PushIn, caller: CallerDep, session: SessionDep):
    settings = get_settings()
    if len(data.events) > settings.max_push_events:
        raise BadRequest(
            "push_too_large",
            f"أقصى عدد أحداث في الحزمة {settings.max_push_events}",
            {"max": settings.max_push_events},
        )
    accepted, duplicates, last_seq = append_events(
        session,
        shop_id=caller.shop_id,
        branch_id=caller.branch_id,
        events=data.events,
        max_event_bytes=settings.max_event_bytes,
    )
    session.commit()
    return PushOut(accepted=accepted, duplicates=duplicates, last_seq=last_seq)


@router.get("/pull", response_model=PullOut)
def pull(
    caller: CallerDep,
    session: SessionDep,
    after: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1)] = 500,
    include_own: bool = False,
):
    limit = min(limit, get_settings().pull_limit_max)
    events, next_after, has_more = pull_events(
        session,
        shop_id=caller.shop_id,
        branch_id=caller.branch_id,
        after=after,
        limit=limit,
        include_own=include_own,
    )
    last_seq = session.scalar(select(Shop.last_seq).where(Shop.id == caller.shop_id)) or 0
    return PullOut(
        events=[
            EventOut(
                id=e.id,
                seq=e.seq,
                branch_id=e.branch_id,
                entity=e.entity,
                entity_id=e.entity_id,
                op=e.op,
                payload=e.payload,
                base_version=e.base_version,
                created_at=e.created_at,
                received_at=e.received_at,
                target_branch_id=e.target_branch_id,
            )
            for e in events
        ],
        next_after=next_after,
        has_more=has_more,
        last_seq=last_seq,
    )


@router.post("/ack", response_model=SyncStatusOut)
def ack(data: AckIn, caller: CallerDep, session: SessionDep):
    shop = session.get(Shop, caller.shop_id)
    branch = session.get(Branch, caller.branch_id)
    if shop is None or branch is None:  # حُذف بين التحقق من التوكن وهنا
        raise BadRequest("branch_unknown", "الفرع غير موجود")
    # لا يرجع للخلف، ولا يتجاوز آخر رقم موجود.
    branch.acked_seq = max(branch.acked_seq, min(data.seq, shop.last_seq))
    session.commit()
    return _status(session, caller)


@router.get("/status", response_model=SyncStatusOut)
def status(caller: CallerDep, session: SessionDep):
    return _status(session, caller)


def _status(session: Session, caller: Caller) -> SyncStatusOut:
    shop = session.get(Shop, caller.shop_id)
    me = session.get(Branch, caller.branch_id)
    branches = session.scalars(
        select(Branch).where(Branch.shop_id == caller.shop_id).order_by(Branch.created_at)
    ).all()
    return SyncStatusOut(
        shop_id=shop.id,
        branch_id=me.id,
        last_seq=shop.last_seq,
        my_last_pushed_seq=me.last_pushed_seq,
        my_acked_seq=me.acked_seq,
        branches=[branch_out(b) for b in branches],
    )


def _last_seq(shop_id: str) -> int:
    with get_sessionmaker()() as session:
        return session.scalar(select(Shop.last_seq).where(Shop.id == shop_id)) or 0


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/stream")
async def stream(
    request: Request,
    caller: CallerDep,
    after: Annotated[int, Query(ge=0)] = 0,
):
    """SSE: «changed» كلما زاد آخر رقم في المحل. يفحص قاعدة البيانات كل ثانيتين (يعمل مع أكثر
    من worker بلا مشاركة ذاكرة). ينتهي مع انتهاء التوكن أو أقصى مدة، والفرع يعيد الاتصال."""
    settings = get_settings()
    deadline = min(
        time.monotonic() + settings.stream_max_seconds,
        time.monotonic() + max((caller.token_exp - datetime.now(UTC)).total_seconds(), 0),
    )

    async def gen():
        sent = after
        last_beat = time.monotonic()
        yield _sse("hello", {"branch_id": caller.branch_id, "after": after})
        while time.monotonic() < deadline:
            current = await run_in_threadpool(_last_seq, caller.shop_id)
            if current > sent:
                sent = current
                yield _sse("changed", {"last_seq": current})
                last_beat = time.monotonic()
            elif time.monotonic() - last_beat >= settings.stream_heartbeat_seconds:
                yield ": ping\n\n"
                last_beat = time.monotonic()
            if await request.is_disconnected():
                return
            await asyncio.sleep(settings.stream_poll_seconds)
        yield _sse("reconnect", {"reason": "expired"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
