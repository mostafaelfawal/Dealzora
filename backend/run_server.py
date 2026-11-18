"""نقطة التشغيل: python run_server.py (تطوير) أو dealzora-backend(.exe) المبني بـ PyInstaller."""

import logging
import os
import signal
import sys
import threading
import time
from logging.handlers import RotatingFileHandler

import uvicorn

from app.core.config import get_settings
from app.core.paths import logs_dir

# المضيف والبورت من الإعدادات (POS_HOST / POS_PORT). الافتراضي 127.0.0.1:8000 (هذا الجهاز فقط).
HOST = get_settings().host
PORT = get_settings().port  # لازم يطابق البورت اللي الـ frontend بيكلمه

# اتصالات البث اللحظي (/events) لا تنتهي وحدها: لا ننتظرها للأبد عند الإيقاف/إعادة التشغيل.
GRACEFUL_S = 3

FROZEN = getattr(sys, "frozen", False)  # True جوا exe بتاع PyInstaller


def setup_file_logging() -> None:
    """في --noconsole بيكون stdout/stderr = None فنحوّل الـ logging لملف:
    <مجلد البيانات>/logs/backend.log (ويندوز: %LOCALAPPDATA%\\Dealzora\\logs، انظر app/core/paths.py)"""
    log_dir = logs_dir()
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


def watch_parent(parent_pid: int | None) -> None:
    """ماك/لينكس: لا يوجد Job كما في ويندوز، فلو أُغلق البرنامج فجأة (crash أو kill -9)
    نخرج نحن أيضاً بدل أن نبقى نحجز البورت فيفشل الإقلاع التالي."""
    if not parent_pid or os.name == "nt":
        return

    def loop() -> None:
        while True:
            time.sleep(2)
            try:
                os.kill(parent_pid, 0)  # الإشارة 0: فحص وجود العملية فقط
            except ProcessLookupError:
                logging.getLogger("dealzora").warning(
                    "app process %s exited; stopping backend", parent_pid
                )
                os.kill(os.getpid(), signal.SIGTERM)  # إيقاف uvicorn بسلام (يُغلق القاعدة)
                return
            except PermissionError:
                pass  # موجودة لكن لمستخدم آخر: نكمل

    threading.Thread(target=loop, name="parent-watch", daemon=True).start()


def main() -> None:
    if FROZEN:
        setup_file_logging()
        watch_parent(get_settings().parent_pid)
        try:
            from app.main import app  # كائن مباشر: import بالنص مش بيشتغل جوا الـ exe

            uvicorn.run(
                app, host=HOST, port=PORT, log_config=None, timeout_graceful_shutdown=GRACEFUL_S
            )
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
        timeout_graceful_shutdown=GRACEFUL_S,
    )


if __name__ == "__main__":
    main()