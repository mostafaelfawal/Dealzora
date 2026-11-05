"""إعدادات التطبيق. القيم الحساسة يمررها Rust عند الإقلاع (متغيرات بيئة POS_*)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="POS_", env_file=".env", extra="ignore"
    )

    db_path: str = r"C:\Dealzora\data\pos.db"
    db_password: str  # SqlCihper passsword
    session_token: str  # توكن الجلسة العشوائي من Rust
    write_permit_secret: str  # سر توقيع "تصريح الكتابة" (الترخيص)
    device_id: str
    debug: bool = False
    cors_origins: list[str] = [
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:3000",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
