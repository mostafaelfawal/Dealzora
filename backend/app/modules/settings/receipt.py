"""شكل الفاتورة المطبوعة (حراري و A4) للمحل كله. يُحفظ في app_settings كـ JSON.

إعداد للمحل لا للجهاز: نفس الشعار والبيانات على كل أجهزة الكاشير والفروع.
نوع الطابعة نفسه (حرارية / A4) خاص بكل جهاز ويُحفظ في الواجهة.
الافتراضي = شكل الإيصال قبل إضافة الإعداد تماماً.
"""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# الشعار صورة صغيرة مضمّنة (الواجهة تصغّرها قبل الرفع). ~180KB بعد base64.
MAX_LOGO_CHARS = 250_000
_LOGO_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$")
_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

DEFAULT_FOOTER = "شكراً لزيارتكم"
DEFAULT_ACCENT = "#1f2937"


class ReceiptConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # ---- أعلى الفاتورة ----
    logo: str | None = Field(None, max_length=MAX_LOGO_CHARS)
    show_logo: bool = True
    address: str = Field("", max_length=160)
    phone: str = Field("", max_length=60)
    tax_number: str = Field("", max_length=40)
    # سطر حر تحت الاسم (مثلاً: «توصيل مجاني للمنازل»).
    header_note: str = Field("", max_length=160)

    # ---- ما يظهر في الفاتورة ----
    show_cashier: bool = True
    show_customer: bool = True
    show_payment_details: bool = True

    # ---- أسفل الفاتورة ----
    footer: str = Field(DEFAULT_FOOTER, max_length=300)
    # شروط الاستبدال والاسترجاع (فاتورة A4 فقط، حيث المساحة متاحة).
    terms: str = Field("", max_length=800)

    # ---- المظهر ----
    font_size: Literal["small", "normal", "large"] = "normal"
    accent: str = DEFAULT_ACCENT

    @field_validator("logo")
    @classmethod
    def _logo(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not _LOGO_RE.match(v):
            raise ValueError("الشعار لازم يكون صورة PNG أو JPG")
        return v

    @field_validator("accent")
    @classmethod
    def _accent(cls, v: str) -> str:
        if not _COLOR_RE.match(v):
            raise ValueError("لون غير صالح")
        return v.lower()

    @field_validator("address", "phone", "tax_number", "header_note", "footer", "terms")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()
