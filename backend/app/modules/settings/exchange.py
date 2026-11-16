"""العملة الثانية وسعر الصرف (مثلاً: المحل يبيع بالدولار ويعرض المقابل بالليرة).

- الإعداد (ExchangeConfig): العملة الثانية وطريقة السعر (تلقائي من الإنترنت / يدوي) وأين يظهر.
- السعر (ExchangeRate): آخر سعر جُلب، يُحفظ في القاعدة فيعمل بدون إنترنت بآخر سعر معروف.

السعر مخزّن دائماً كـ «كم وحدة من العملة الثانية = 1 من عملة المحل» (second_per_main)،
والواجهة تعرضه بالاتجاه الأوضح (1 دولار = 89,500 ليرة).

المصدر التلقائي: open.er-api.com (مجاني، بلا مفتاح، يتحدث يومياً، يدعم كل العملات العربية).
للدول التي فيها سعر سوق مختلف عن الرسمي، التاجر يختار «يدوي» ويكتب السعر الذي يتعامل به.
"""

import json
import logging
import time
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

logger = logging.getLogger(__name__)

RATE_API_URL = "https://open.er-api.com/v6/latest/{base}"
RATE_API_TIMEOUT = 8
RATE_SOURCE = "open.er-api.com"
# السعر التلقائي أقدم من هذا = نحاول تحديثه عند فتح اللوحة.
STALE_AFTER_SECONDS = 6 * 3600


class ExchangeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    code: str = Field("USD", min_length=3, max_length=3)
    symbol: str = Field("$", min_length=1, max_length=8)
    name: str = Field("دولار أمريكي", min_length=1, max_length=40)
    mode: Literal["auto", "manual"] = "auto"
    # السعر اليدوي: manual_base = "main" ← 1 من عملة المحل = manual_rate من الثانية،
    # و "second" ← 1 من الثانية = manual_rate من عملة المحل (الأسهل حسب أي العملتين أكبر).
    manual_rate: float | None = Field(None, gt=0, lt=1e12)
    manual_base: Literal["main", "second"] = "second"
    # كسور العملة الثانية في العرض (الليرة 0، الدولار 2).
    decimals: int = Field(2, ge=0, le=3)
    show_in_pos: bool = True
    show_on_receipt: bool = True

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v.isalpha():
            raise ValueError("رمز العملة 3 حروف إنجليزية (مثل USD)")
        return v

    @field_validator("symbol", "name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def _manual_needs_rate(self) -> "ExchangeConfig":
        if self.enabled and self.mode == "manual" and not self.manual_rate:
            raise ValueError("اكتب سعر الصرف")
        return self

    def manual_second_per_main(self) -> float | None:
        if not self.manual_rate:
            return None
        return self.manual_rate if self.manual_base == "main" else 1 / self.manual_rate


class ExchangeRate(BaseModel):
    """آخر سعر معروف لزوج (عملة المحل ← الثانية)."""

    main: str
    second: str
    second_per_main: float
    source: str  # open.er-api.com | manual
    # وقت تحديث السعر عند المصدر، ووقت جلبنا له (unix).
    rate_updated_at: int
    fetched_at: int


class ExchangeOut(BaseModel):
    config: ExchangeConfig
    # null = لا سعر بعد (أول تشغيل بلا إنترنت، أو العملتان متطابقتان).
    rate: ExchangeRate | None
    stale: bool


class RateFetchError(Exception):
    """رسالة عربية جاهزة للعرض."""


def fetch_rate(main: str, second: str, *, opener=urlopen) -> ExchangeRate:
    """يجلب السعر من الإنترنت. opener قابل للاستبدال في الاختبارات."""
    req = Request(
        RATE_API_URL.format(base=main),
        headers={"Accept": "application/json", "User-Agent": "Dealzora-POS"},
    )
    try:
        with opener(req, timeout=RATE_API_TIMEOUT) as resp:  # noqa: S310 - رابط https ثابت
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        logger.warning("exchange rate http %s", e.code)
        raise RateFetchError("خدمة أسعار الصرف لا تستجيب الآن. حاول بعد قليل.") from e
    except (URLError, TimeoutError, OSError) as e:
        raise RateFetchError("تعذّر الاتصال بالإنترنت لجلب سعر الصرف.") from e
    except ValueError as e:
        raise RateFetchError("رد غير مفهوم من خدمة أسعار الصرف.") from e

    if not isinstance(payload, dict) or payload.get("result") != "success":
        raise RateFetchError(f"العملة {main} غير مدعومة في خدمة أسعار الصرف.")
    rates = payload.get("rates") or {}
    value = rates.get(second)
    if not isinstance(value, (int, float)) or value <= 0:
        raise RateFetchError(f"لا يوجد سعر صرف بين {main} و {second}.")
    now = int(time.time())
    updated = payload.get("time_last_update_unix")
    return ExchangeRate(
        main=main,
        second=second,
        second_per_main=float(value),
        source=RATE_SOURCE,
        rate_updated_at=int(updated) if isinstance(updated, (int, float)) else now,
        fetched_at=now,
    )


def is_stale(rate: ExchangeRate | None, now: float | None = None) -> bool:
    if rate is None:
        return True
    return (now or time.time()) - rate.fetched_at > STALE_AFTER_SECONDS
