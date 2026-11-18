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
    # نطاقات نسخة الويب من تطبيق الهاتف (PWA) المسموح لها باستدعاء /mobile/v1 من المتصفح.
    # فارغ = لا CORS (تطبيق أندرويد وأجهزة الفروع لا تحتاجه). مثال: https://app.dealzora.com
    cors_origins: Annotated[list[str], NoDecode] = []

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

    # تطبيق الهاتف (المالك ومديرو الفروع): توكن وصول قصير + refresh يُلغى، وكود ربط الهاتف بالمحل.
    mobile_access_ttl_minutes: int = Field(10, ge=1, le=60)
    # الـ refresh يتجدد مع كل استخدام: هاتف لم يُفتح هذه المدة يحتاج كود ربط جديد.
    mobile_refresh_days: int = Field(30, ge=1, le=180)
    mobile_code_ttl_minutes: int = Field(15, ge=1, le=24 * 60)
    # محاولات كلمة مرور خاطئة على نفس الكود قبل إبطاله.
    mobile_code_max_attempts: int = Field(5, ge=1, le=20)
    # حالة الفرع في التطبيق: «متصل» ضمن online_window_seconds، «متأخر» حتى هذه المدة، ثم «منقطع».
    mobile_late_minutes: int = Field(15, ge=1, le=24 * 60)
    # موافقة تحويل من الهاتف ينفّذها جهاز الفرع: لو لم يأخذها خلال هذه المدة تنتهي (فرع منقطع/إصدار قديم).
    mobile_command_ttl_hours: int = Field(24, ge=1, le=24 * 14)
    # خدمة التنبيهات (python -m app.cli notifier): كل كم ثانية تفحص الأحداث وترسل.
    notify_interval_seconds: int = Field(60, ge=10, le=3600)
    # تجميع: لا أكثر من إشعار push واحد لكل حساب خلال هذه المدة (الأحداث المتقاربة تُرسل معاً).
    notify_min_gap_minutes: int = Field(3, ge=0, le=120)
    # أحداث أقدم من هذا لا تُنشئ تنبيهاً (أول تشغيل لا يغرق الهاتف بالقديم).
    notify_lookback_hours: int = Field(24, ge=1, le=24 * 7)
    # «مبيعات أقل كثيراً من المعتاد»: صافي أمس أقل من هذه النسبة من متوسط نفس اليوم في 4 أسابيع سابقة،
    # ويُفحص بعد هذه الساعة بتوقيت المستخدم (حتى تكتمل ملخصات أمس).
    low_sales_ratio: float = Field(0.5, gt=0, lt=1)
    low_sales_after_hour: int = Field(10, ge=0, le=23)
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    # اختياري: لو فعّلت «Enhanced security for push notifications» في expo.dev.
    expo_access_token: str = ""
    # الخطط المسموح لها بتطبيق الهاتف («سلسلة» فقط).
    mobile_plans: Annotated[list[str], NoDecode] = ["enterprise"]

    # المتجر الإلكتروني: الخطط المسموح لها («سلسلة» فقط)، والعنوان العام لواجهة المتجر
    # (الرابط الذي يشاركه المالك = هذا العنوان + "/" + slug). مثال: https://store.dealzora.com
    store_plans: Annotated[list[str], NoDecode] = ["enterprise"]
    store_public_url: str = ""
    # حماية الواجهة العامة: قراءات لكل IP في الدقيقة، وطلبات شراء لكل IP ولكل هاتف خلال 10 دقائق.
    store_read_rate_per_min: int = Field(240, ge=10)
    store_order_rate_per_ip: int = Field(6, ge=1)
    store_order_rate_per_phone: int = Field(3, ge=1)
    # الصور: أقصى حجم للصورة (بعد ضغطها في البرنامج) وأقصى عدد لكل محل.
    store_image_max_bytes: int = Field(600_000, ge=20_000, le=5_000_000)
    store_max_images: int = Field(3000, ge=10)
    store_max_products: int = Field(5000, ge=10)

    @field_validator("jwt_secret", "admin_token")
    @classmethod
    def _strong(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("يجب أن يكون 32 حرفاً على الأقل (openssl rand -hex 32)")
        return value

    @field_validator(
        "admin_allowed_ips", "register_plans", "mobile_plans", "store_plans", "cors_origins", mode="before"
    )
    @classmethod
    def _ips(cls, value: object) -> object:
        if isinstance(value, str):
            return [ip.strip() for ip in value.split(",") if ip.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
