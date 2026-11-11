"""إعدادات التطبيق. القيم الحساسة يمررها Rust عند الإقلاع (متغيرات بيئة POS_*)."""

import sys
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# نسخة الـ exe (PyInstaller): كل القيم من Rust فقط، ولا نقرأ أي .env من مجلد التشغيل
# (لا يغيّر أحد مسار القاعدة أو الإعدادات بوضع ملف بجانب البرنامج). .env للتطوير فقط.
_FROZEN = getattr(sys, "frozen", False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="POS_", env_file=None if _FROZEN else ".env", extra="ignore"
    )

    db_path: str = r"C:\Dealzora\data\pos.db"
    db_password: str  # SqlCihper passsword
    session_token: str  # توكن الجلسة العشوائي من Rust
    write_permit_secret: str  # سر توقيع "تصريح الكتابة" (الترخيص)
    device_id: str
    # 127.0.0.1 = هذا الجهاز فقط. 0.0.0.0 = يقبل أجهزة الكاشير على شبكة المحل
    # (Rust يحدده من إعداد «السماح لأجهزة الكاشير»). كل طلب يحتاج توكن جهاز في الحالتين.
    host: str = "127.0.0.1"
    port: int = 8000
    # الخطة من الترخيص (Rust). الافتراضي الأضيق «بَسطة» المجانية. للتطوير: POS_PLAN=pro في .env
    plan: str = "free"
    debug: bool = False
    cors_origins: list[str] = [
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:3000",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
