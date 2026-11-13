"""إعدادات السيرفر من متغيرات البيئة (ملف .env محلياً أو عبر docker compose)."""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SYNC_", extra="ignore")

    # postgresql+psycopg://user:pass@db:5432/dealzora_sync
    database_url: str = "sqlite:///./dev.db"
    # سر توقيع توكنات الفروع (JWT). 32 حرفاً على الأقل: openssl rand -hex 32
    jwt_secret: str
    # توكن لوحة الإدارة (أنت فقط): إنشاء المحلات والفروع وأكواد الربط.
    admin_token: str
    # IPs المسموح لها بلوحة الإدارة (فارغ = أي IP). مثال: 41.33.10.5,127.0.0.1
    admin_allowed_ips: Annotated[list[str], NoDecode] = []
    token_ttl_minutes: int = Field(30, ge=5, le=24 * 60)

    # الحماية من التخمين والإغراق: أقصى طلبات /auth لكل IP في الدقيقة، وأقصى حجم طلب.
    auth_rate_per_min: int = Field(20, ge=1)
    max_body_bytes: int = Field(20_000_000, ge=10_000)
    # كود ربط جهاز الفرع: صالح كم دقيقة، ومرة واحدة فقط.
    pairing_ttl_minutes: int = Field(15, ge=1, le=24 * 60)

    max_push_events: int = Field(500, ge=1, le=5000)
    max_event_bytes: int = Field(256_000, ge=1_000)
    pull_limit_max: int = Field(1000, ge=10, le=10_000)
    # كتالوج الأصناف والعملاء: أقصى سجلات في حزمة رفع واحدة.
    max_catalog_push: int = Field(200, ge=1, le=2000)

    # البث (SSE): كل كم ثانية نفحص الجديد، ونبضة لإبقاء الاتصال، وأقصى عمر للاتصال
    # (الفرع يعيد الاتصال تلقائياً بتوكن جديد).
    stream_poll_seconds: float = Field(2.0, gt=0)
    stream_heartbeat_seconds: float = Field(15.0, gt=0)
    stream_max_seconds: float = Field(600.0, gt=0)
    # الفرع «متصل» لو ظهر خلال هذه المدة.
    online_window_seconds: int = Field(120, ge=10)

    docs_enabled: bool = False

    # التسجيل الذاتي للمحلات: المفتاح العام لتوقيع التراخيص (نفس DEALZORA_VENDOR_PUBKEY في البرنامج،
    # base64url). فارغ = التسجيل الذاتي مقفول، والمحلات تُنشأ من أوامر الإدارة فقط.
    vendor_pubkey: str = ""
    # الخطط المسموح لها بإنشاء محل متعدد الفروع (ترخيص قديم بلا خطة = كل الميزات).
    register_plans: Annotated[list[str], NoDecode] = ["enterprise"]
    max_branches_per_shop: int = Field(50, ge=1, le=1000)
    # بعد انتهاء الترخيص: كم يوم مهلة قبل إيقاف مزامنة المحل.
    license_grace_days: int = Field(7, ge=0, le=90)
    # شهادة الفرع: أجهزة الفروع ترث خطة المحل. مفتاح Ed25519 خاص (base64url، 32 بايت):
    #   python -m app.cli lease-keygen   ← يطبع المفتاح الخاص (هنا) والعام (في بناء البرنامج).
    lease_key: str = ""
    lease_ttl_days: int = Field(7, ge=1, le=30)
    # خطة المحلات اللي أنشأتها يدوياً بلا ترخيص.
    legacy_shop_plan: str = "enterprise"

    @field_validator("jwt_secret", "admin_token")
    @classmethod
    def _strong(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("يجب أن يكون 32 حرفاً على الأقل (openssl rand -hex 32)")
        return value

    @field_validator("admin_allowed_ips", "register_plans", mode="before")
    @classmethod
    def _ips(cls, value: object) -> object:
        if isinstance(value, str):
            return [ip.strip() for ip in value.split(",") if ip.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
