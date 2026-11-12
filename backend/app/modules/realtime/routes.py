"""GET /events: بث لحظي (Server-Sent Events) لأسماء المواضيع التي تغيّرت.

التحقق من الجهاز والمستخدم يتم بجلسة قصيرة تُغلق فوراً (لا نحجز اتصال قاعدة طوال البث)،
ويُعاد كل دقيقة: تسجيل خروج أو إلغاء اقتران الجهاز يقطع البث.
"""

import asyncio
import json
import time
from typing import Annotated

from fastapi import APIRouter, Header, Request
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.core.bearer import get_bearer_token
from app.core.caller import get_caller
from app.core.database import get_sessionmaker
from app.core.realtime import hub

router = APIRouter(tags=["realtime"])

HEARTBEAT_S = 15  # الجهاز يعتبر البث مقطوعاً لو لم يصله شيء خلال ~35 ثانية
REAUTH_S = 60


def _authenticate(
    authorization: str | None, x_session_token: str | None, x_device_token: str | None
) -> None:
    from app.modules.auth.service import AuthService  # متأخر: تفادي الدوران

    token = get_bearer_token(authorization)
    with get_sessionmaker()() as session:
        caller = get_caller(session, x_session_token, x_device_token)
        AuthService(session).authenticate(token, caller.device_id)


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/events")
async def events(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    x_session_token: Annotated[str | None, Header()] = None,
    x_device_token: Annotated[str | None, Header()] = None,
):
    auth = (authorization, x_session_token, x_device_token)
    await run_in_threadpool(_authenticate, *auth)  # خطأ هنا = رد 401/403 عادي قبل البث

    async def stream():
        sub = hub.subscribe()
        _, queue = sub
        checked = time.monotonic()
        try:
            yield _sse("hello", {"heartbeat": HEARTBEAT_S})
            while True:
                try:
                    topics = await asyncio.wait_for(queue.get(), HEARTBEAT_S)
                    # تجميع ما تراكم (بيع واحد يلمس عدة مواضيع في معاملات متتالية)
                    merged = set(topics)
                    while not queue.empty():
                        merged.update(queue.get_nowait())
                    yield _sse("change", {"topics": sorted(merged)})
                except TimeoutError:
                    yield ": ping\n\n"
                if time.monotonic() - checked > REAUTH_S:
                    checked = time.monotonic()
                    try:
                        await run_in_threadpool(_authenticate, *auth)
                    except Exception:
                        yield _sse("unauthorized", {})
                        return
                if await request.is_disconnected():
                    return
        finally:
            hub.unsubscribe(sub)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
