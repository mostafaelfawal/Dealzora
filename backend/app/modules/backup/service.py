"""النسخ الاحتياطي المحلي: نسخة مشفّرة كاملة من القاعدة بنفس مفتاح SQLCipher.

- تُنشأ بـ SQLite Online Backup API (آمنة أثناء عمل التطبيق، لا تقفل القاعدة طويلاً).
- تلقائياً عند الإقلاع لو آخر نسخة أقدم من AUTO_BACKUP_HOURS، ويدوياً من الإعدادات.
- نحتفظ بآخر KEEP_BACKUPS نسخة ونحذف الأقدم.
- المجلد يحدده المدير (إعداد backup.dir في القاعدة). لو غير متاح (فلاشة مفصولة)
  نكتب في المجلد الافتراضي حتى لا يضيع النسخ التلقائي.
- الاستعادة بنفس Backup API لكن بالاتجاه العكسي (من الملف إلى القاعدة الحية):
  لا نستبدل الملف وهو مفتوح، فلا مشاكل أقفال ويندوز ولا خلط مع ملف WAL القديم.
  قبلها نأخذ نسخة أمان من الوضع الحالي.
الرفع للسحابة يعتمد على عامل المزامنة (outbox) وخادم Dealzora، وليس هنا.
"""

import os
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import sqlcipher3

from app.core.config import get_settings
from app.core.database import get_engine
from app.core.errors import BadRequestError
from app.modules.settings.constants import SettingKey
from app.modules.settings.service import read_setting

BACKUP_DIR_NAME = "backups"
BACKUP_PREFIX = "dealzora-"
BACKUP_SUFFIX = ".db"
SAFETY_TAG = "before-restore"
KEEP_BACKUPS = 14
AUTO_BACKUP_HOURS = 24
# جدول لا بد أن يوجد في أي نسخة من Dealzora (للتأكد أن الملف قاعدتنا فعلاً).
_REQUIRED_TABLE = "shop"

_lock = threading.Lock()


@dataclass(frozen=True, slots=True)
class BackupFile:
    name: str
    size: int
    created_at: datetime


@dataclass(frozen=True, slots=True)
class BackupLocation:
    path: Path
    is_default: bool
    # المدير حدّد مجلداً لكنه غير متاح الآن، فنكتب في الافتراضي مؤقتاً.
    fallback: bool
    configured: str | None


# ================= المجلد =================
def default_backup_dir() -> Path:
    return Path(get_settings().db_path).parent / BACKUP_DIR_NAME


def ensure_writable(raw: str) -> Path:
    """ينشئ المجلد لو ناقص ويجرب الكتابة فيه. يرفع BadRequestError بسبب واضح."""
    path = Path(os.path.expandvars(raw)).expanduser()
    if not path.is_absolute():
        raise BadRequestError("backup_dir_invalid", "اكتب المسار كاملاً، مثل D:\\Dealzora-Backups")
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / f".write-test-{uuid.uuid4().hex}"
        probe.write_bytes(b"ok")
        probe.unlink()
    except OSError as exc:
        raise BadRequestError(
            "backup_dir_not_writable",
            "لا يمكن الكتابة في هذا المجلد. تأكد من توصيل الفلاشة/القرص أو اختر مجلداً آخر",
        ) from exc
    return path


def current_location() -> BackupLocation:
    configured = read_setting(SettingKey.BACKUP_DIR)
    if configured:
        try:
            return BackupLocation(ensure_writable(configured), False, False, configured)
        except BadRequestError:
            fallback = default_backup_dir()
            fallback.mkdir(parents=True, exist_ok=True)
            return BackupLocation(fallback, True, True, configured)
    folder = default_backup_dir()
    folder.mkdir(parents=True, exist_ok=True)
    return BackupLocation(folder, True, False, None)


def backup_dir() -> Path:
    return current_location().path


# ================= القائمة والإنشاء =================
def list_backups(folder: Path | None = None) -> list[BackupFile]:
    folder = folder or backup_dir()
    files = []
    for path in folder.glob(f"{BACKUP_PREFIX}*{BACKUP_SUFFIX}"):
        stat = path.stat()
        files.append(
            BackupFile(
                name=path.name,
                size=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            )
        )
    return sorted(files, key=lambda f: f.created_at, reverse=True)


def _key_pragma() -> str:
    password = get_settings().db_password.replace("'", "''")
    return f"PRAGMA key = '{password}'"


def _create_unlocked(folder: Path, tag: str = "") -> BackupFile:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    suffix = f"-{tag}" if tag else ""
    target = folder / f"{BACKUP_PREFIX}{stamp}{suffix}{BACKUP_SUFFIX}"
    tmp = target.with_suffix(".tmp")
    raw = get_engine().raw_connection()
    try:
        dest = sqlcipher3.connect(str(tmp))
        try:
            dest.execute(_key_pragma())
            raw.driver_connection.backup(dest)  # type: ignore[union-attr]
        finally:
            dest.close()
    finally:
        raw.close()
    os.replace(tmp, target)  # ذري: لا توجد نسخة نصف مكتوبة باسم نهائي
    _prune(folder)
    stat = target.stat()
    return BackupFile(
        name=target.name,
        size=stat.st_size,
        created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
    )


def create_backup(tag: str = "") -> BackupFile:
    """نسخة مشفّرة جديدة. القفل يمنع نسختين متزامنتين."""
    with _lock:
        return _create_unlocked(backup_dir(), tag)


def _prune(folder: Path) -> None:
    for old in list_backups(folder)[KEEP_BACKUPS:]:
        try:
            (folder / old.name).unlink()
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


# ================= الاستعادة =================
def resolve_backup(name: str | None, path: str | None) -> Path:
    """نسخة من القائمة (بالاسم) أو ملف اختاره المدير (فلاشة مثلاً)."""
    if name:
        # الاسم فقط، بدون مسارات (منع ../).
        if Path(name).name != name or not name.endswith(BACKUP_SUFFIX):
            raise BadRequestError("backup_not_found", "النسخة غير موجودة")
        source = backup_dir() / name
    elif path:
        source = Path(path.strip().strip('"'))
    else:
        raise BadRequestError("backup_not_found", "اختر نسخة للاستعادة")
    if not source.is_file():
        raise BadRequestError("backup_not_found", "الملف غير موجود. تأكد من توصيل الفلاشة/القرص")
    if source.resolve() == Path(get_settings().db_path).resolve():
        raise BadRequestError("backup_invalid", "هذا ملف القاعدة الحالية نفسه، وليس نسخة احتياطية")
    return source


def validate_backup(source: Path) -> None:
    """يفتح الملف بمفتاح هذا الجهاز ويفحص سلامته. لا يعدّل شيئاً."""
    try:
        conn = sqlcipher3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
        try:
            conn.execute(_key_pragma())
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            check = conn.execute("PRAGMA quick_check").fetchone()
        finally:
            conn.close()
    except sqlcipher3.DatabaseError as exc:
        raise BadRequestError(
            "backup_invalid",
            "تعذّر فتح الملف. إما أنه ليس نسخة Dealzora، أو أُنشئ على جهاز آخر (النسخ مشفّرة بمفتاح الجهاز)",
        ) from exc
    if _REQUIRED_TABLE not in tables:
        raise BadRequestError("backup_invalid", "هذا الملف ليس نسخة احتياطية من Dealzora")
    if not check or check[0] != "ok":
        raise BadRequestError("backup_corrupt", "النسخة تالفة ولا يمكن استعادتها. جرّب نسخة أقدم")


def restore_backup(source: Path) -> BackupFile:
    """يستبدل كل البيانات الحالية بالنسخة. يرجع نسخة الأمان المأخوذة قبلها."""
    validate_backup(source)
    with _lock:
        safety = _create_unlocked(backup_dir(), SAFETY_TAG)
        engine = get_engine()
        engine.dispose()  # اتصالات الـ pool الخاملة تُغلق، والجديدة تقرأ البيانات المستعادة
        src = sqlcipher3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
        raw = engine.raw_connection()
        try:
            src.execute(_key_pragma())
            src.backup(raw.driver_connection)  # type: ignore[arg-type]
        finally:
            raw.close()
            src.close()
        engine.dispose()
    return safety
