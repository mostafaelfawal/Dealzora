import os
import subprocess
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.init_db import init_db
from app.modules.backup.service import auto_backup_if_due


def prepare_data_dir(db_path: str) -> None:
    """ينشئ مجلد Dealzora ويقصر الوصول عليك + SYSTEM + Administrators (ويندوز)."""
    folder = Path(db_path).parent
    first_time = not folder.exists()
    folder.mkdir(parents=True, exist_ok=True)
    if first_time and os.name == "nt":
        root = folder.parent
        user = os.environ.get("USERNAME", "")
        subprocess.run(
            [
                "icacls",
                str(root),
                "/inheritance:r",
                "/grant:r",
                f"{user}:(OI)(CI)F",
                "/grant:r",
                "SYSTEM:(OI)(CI)F",
                "/grant:r",
                "Administrators:(OI)(CI)F",
            ],
            check=False,
            capture_output=True,
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    prepare_data_dir(settings.db_path)
    init_db()
    # نسخة احتياطية تلقائية في الخلفية (لا تؤخر الإقلاع).
    threading.Thread(target=auto_backup_if_due, name="auto-backup", daemon=True).start()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Dealzora Local API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.debug else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        # أجهزة الكاشير تتصل بالجهاز الأساسي على عنوان شبكة محلية (192.168.x.x):
        # Chromium/WebView2 يطلب هذا الإذن (Private Network Access) قبل الطلب.
        allow_private_network=True,
    )
    register_error_handlers(app)
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
