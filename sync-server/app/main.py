"""Dealzora Sync Hub: سيرفر المزامنة بين فروع المحل الواحد.

كل فرع يبيع على قاعدته المحلية حتى بدون إنترنت، ويرفع أحداثه (outbox) هنا ويسحب أحداث
باقي الفروع. السيرفر لا يبيع ولا يحسب مخزوناً: ينقل الأحداث بترتيب مضمون، ويملك حالة
تحويلات المخزون، ويجمع الملخصات اليومية للتقارير.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .db import get_engine
from .errors import register_error_handlers
from .routers import (
    admin,
    auth,
    branches,
    catalog,
    mobile,
    reports,
    shop,
    stats,
    store,
    sync,
    transfer_commands,
    transfers,
)

API_PREFIX = "/v1"


def migrate_sqlite() -> None:
    """التشغيل المحلي على SQLite: إنشاء/تحديث الجداول تلقائياً عند الإقلاع (ملف مُسح أو جديد).
    PostgreSQL (الإنتاج) يُحدَّث من deploy/entrypoint.sh قبل تشغيل الـ workers، لا هنا."""
    if get_engine().dialect.name != "sqlite":
        return
    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate_sqlite()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = FastAPI(
        title="Dealzora Sync Hub",
        version="1.0.0",
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
    )
    register_error_handlers(app)
    if settings.cors_origins:
        # نسخة الويب (PWA) فقط: مسارات الهاتف بتوكن في الـ header (لا cookies، فلا credentials).
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[o.rstrip("/") for o in settings.cors_origins],
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
            max_age=600,
        )
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
        auth.router, shop.router, branches.router, sync.router, catalog.router, transfer_commands.router,
        transfers.router, stats.router, reports.router,
        store.owner_router, store.branch_router, store.public_router,
        admin.router,
    )  # fmt: skip
    for router in routers:
        app.include_router(router, prefix=API_PREFIX)
    # تطبيق الهاتف: مسارات وتوكنات منفصلة عن الفروع.
    app.include_router(mobile.router, prefix=mobile.PREFIX)

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}

    return app


app = create_app()
