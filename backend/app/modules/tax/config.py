"""إعداد ضريبة القيمة المضافة للمحل (يُحفظ في app_settings كـ JSON).

الافتراضي: متوقفة. فالمحل الذي لم يغيّر شيئاً يرى نفس الأسعار والإجماليات والإيصال تماماً.
عند التشغيل: الأسعار شاملة الضريبة افتراضياً (لا تتغير أسعار البيع الحالية) والنسبة 14%.
"""

from pydantic import BaseModel, ConfigDict, Field

from .constants import DEFAULT_RATE, MAX_RATE, TaxMode


class TaxConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # المحل مسجل في ضريبة القيمة المضافة.
    enabled: bool = False
    # أسعار البيع المكتوبة على الأصناف شاملة الضريبة.
    prices_include_tax: bool = True
    # النسبة الافتراضية للأصناف الجديدة (نقاط أساس: 1400 = 14%).
    default_rate: int = Field(DEFAULT_RATE, ge=1, le=MAX_RATE)


def tax_mode(cfg: TaxConfig) -> TaxMode:
    if not cfg.enabled:
        return TaxMode.OFF
    return TaxMode.INCLUSIVE if cfg.prices_include_tax else TaxMode.EXCLUSIVE
