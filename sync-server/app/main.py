"""Dealzora Sync Hub: سيرفر المزامنة بين فروع المحل الواحد.

كل فرع يبيع على قاعدته المحلية حتى بدون إنترنت، ويرفع أحداثه (outbox) هنا ويسحب أحداث
باقي الفروع. السيرفر لا يبيع ولا يحسب مخزوناً: ينقل الأحداث بترتيب مضمون، ويملك حالة
تحويلات المخزون، ويجمع الملخصات اليومية للتقارير.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .db import get_engine
from .errors import register_error_handlers
from .routers import admin, auth, branches, catalog, stats, sync, transfers

API_PREFIX = "/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = FastAPI(
        title="Dealzora Sync Hub",
        version="1.0.0",
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )
    register_error_handlers(app)
    log = logging.getLogger("sync")

    @app.middleware("http")
    async def _guard(request: Request, call_next):  # noqa: ANN202
        # حد حجم الطلب (حتى بدون Caddy، مثل التشغيل المحلي).
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > settings.max_body_bytes:
            return JSONResponse(
                {"error": {"code": "payload_too_large", "message": "الطلب أكبر من الحد المسموح", "details": None}},
                status_code=413,
            )
        try:
            response = await call_next(request)
        except Exception:
            # لا نكشف تفاصيل داخلية للعميل أبداً، والتفاصيل في اللوج فقط.
            log.exception("unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(
                {"error": {"code": "server_error", "message": "حدث خطأ في السيرفر", "details": None}},
                status_code=500,
            )
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    routers = (
        auth.router, branches.router, sync.router, catalog.router, transfers.router, stats.router, admin.router,
    )  # fmt: skip
    for router in routers:
        app.include_router(router, prefix=API_PREFIX)

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}

    return app


app = create_app()
