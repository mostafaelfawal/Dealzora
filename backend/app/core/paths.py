"""مسارات البرنامج على كل نظام (يجب أن تطابق frontend/src-tauri/src/paths.rs).

- ويندوز: القاعدة في C:\\Dealzora\\data والسجلات في %LOCALAPPDATA%\\Dealzora\\logs (كما كانت دائماً).
- ماك:    ~/Library/Application Support/Dealzora
- لينكس:  $XDG_DATA_HOME/Dealzora (الافتراضي ~/.local/share/Dealzora)
"""

import os
import sys
from pathlib import Path

IS_WINDOWS = os.name == "nt"


def local_dir() -> Path:
    """مجلد بيانات المستخدم الخاص بالبرنامج (السجلات وملفات الجهاز)."""
    if IS_WINDOWS:
        return Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Dealzora"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Dealzora"
    xdg = os.environ.get("XDG_DATA_HOME", "")
    base = Path(xdg) if xdg and Path(xdg).is_absolute() else Path.home() / ".local" / "share"
    return base / "Dealzora"


# نسخة الـ exe (PyInstaller) = إنتاج. غير ذلك = تطوير (تشغيل من الكود المصدري).
IS_FROZEN = getattr(sys, "frozen", False)


def default_db_path() -> str:
    """مسار القاعدة الافتراضي. على ويندوز لا يتغير في الإنتاج (نسخ العملاء الحالية تعتمد عليه).

    في التطوير نستخدم مجلد dev-data منفصلاً حتى لا نلمس قاعدة الإنتاج على نفس الجهاز
    (النسخ الاحتياطية وملف المرساة تتبع مجلد القاعدة تلقائياً).
    """
    folder = "data" if IS_FROZEN else "dev-data"
    if IS_WINDOWS:
        return rf"C:\Dealzora\{folder}\pos.db"
    return str(local_dir() / folder / "pos.db")


def logs_dir() -> Path:
    return local_dir() / "logs"
