"""النسخ الاحتياطي المحلي: نسخة مشفّرة كاملة من القاعدة بنفس مفتاح SQLCipher.

- تُنشأ بـ SQLite Online Backup API (آمنة أثناء عمل التطبيق، لا تقفل القاعدة طويلاً).
- تلقائياً عند الإقلاع لو آخر نسخة أقدم من AUTO_BACKUP_HOURS، ويدوياً من الإعدادات.
- نحتفظ بآخر KEEP_BACKUPS نسخة ونحذف الأقدم.
الرفع للسحابة يعتمد على عامل المزامنة (outbox) وخادم Dealzora، وليس هنا.
"""

import os
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import sqlcipher3

from app.core.config import get_settings
from app.core.database import get_engine

BACKUP_DIR_NAME = "backups"
BACKUP_PREFIX = "dealzora-"
BACKUP_SUFFIX = ".db"
KEEP_BACKUPS = 14
AUTO_BACKUP_HOURS = 24

_lock = threading.Lock()


@dataclass(frozen=True, slots=True)
class BackupFile:
    name: str
    size: int
    created_at: datetime


def backup_dir() -> Path:
    folder = Path(get_settings().db_path).parent / BACKUP_DIR_NAME
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def list_backups() -> list[BackupFile]:
    files = []
    for path in backup_dir().glob(f"{BACKUP_PREFIX}*{BACKUP_SUFFIX}"):
        stat = path.stat()
        files.append(
            BackupFile(
                name=path.name,
                size=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            )
        )
    return sorted(files, key=lambda f: f.created_at, reverse=True)


def create_backup() -> BackupFile:
    """نسخة مشفّرة جديدة. القفل يمنع نسختين متزامنتين."""
    with _lock:
        settings = get_settings()
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        target = backup_dir() / f"{BACKUP_PREFIX}{stamp}{BACKUP_SUFFIX}"
        tmp = target.with_suffix(".tmp")
        raw = get_engine().raw_connection()
        try:
            dest = sqlcipher3.connect(str(tmp))
            try:
                password = settings.db_password.replace("'", "''")
                dest.execute(f"PRAGMA key = '{password}'")
                raw.driver_connection.backup(dest)  # type: ignore[union-attr]
            finally:
                dest.close()
        finally:
            raw.close()
        os.replace(tmp, target)  # ذري: لا توجد نسخة نصف مكتوبة باسم نهائي
        _prune()
        stat = target.stat()
        return BackupFile(
            name=target.name,
            size=stat.st_size,
            created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        )


def _prune() -> None:
    for old in list_backups()[KEEP_BACKUPS:]:
        try:
            (backup_dir() / old.name).unlink()
        except OSError:
            pass


def auto_backup_if_due() -> None:
    """يُستدعى في خيط خلفي عند الإقلاع. الفشل لا يوقف التطبيق."""
    try:
        latest = list_backups()
        due = not latest or datetime.now(timezone.utc) - latest[0].created_at > timedelta(
            hours=AUTO_BACKUP_HOURS
        )
        if due:
            create_backup()
    except Exception:  # noqa: BLE001 - النسخ التلقائي لا يجب أن يُسقط الخادم
        pass
