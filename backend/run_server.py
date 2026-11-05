"""نقطة التشغيل: python run_server.py (تطوير) أو dealzora-backend.exe (PyInstaller)."""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

import uvicorn

from app.core.config import get_settings

HOST = "127.0.0.1"  # محلي فقط، مش متاح للشبكة
PORT = 8000  # لازم يطابق البورت اللي الـ frontend بيكلمه

FROZEN = getattr(sys, "frozen", False)  # True جوا exe بتاع PyInstaller


def setup_file_logging() -> None:
    """في --noconsole بيكون stdout/stderr = None فنحوّل الـ logging لملف:
    %LOCALAPPDATA%\\Dealzora\\logs\\backend.log"""
    log_dir = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Dealzora" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    handler = RotatingFileHandler(
        log_dir / "backend.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")


def main() -> None:
    if FROZEN:
        setup_file_logging()
        try:
            from app.main import app  # كائن مباشر: import بالنص مش بيشتغل جوا الـ exe

            uvicorn.run(app, host=HOST, port=PORT, log_config=None)
        except Exception:
            logging.getLogger("dealzora").exception("backend crashed")
            raise
        return

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=settings.debug,  # إعادة تشغيل تلقائي وقت التطوير فقط
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()