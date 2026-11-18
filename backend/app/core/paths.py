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


def default_db_path() -> str:
    """مسار القاعدة الافتراضي. على ويندوز لا يتغير (نسخ العملاء الحالية تعتمد عليه)."""
    if IS_WINDOWS:
        return r"C:\Dealzora\data\pos.db"
    return str(local_dir() / "data" / "pos.db")


def logs_dir() -> Path:
    return local_dir() / "logs"
