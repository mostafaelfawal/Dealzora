"""باركود الميزان (Scale / PLU barcode) للأصناف الموزونة.

الميزان يطبع ملصقاً بباركود EAN-13 داخلي (البادئات 20..29 محجوزة للاستخدام داخل المحل):

    [بادئة][كود الصنف على الميزان][الوزن أو السعر][...][رقم التحقق]
     20      01234                  01250                 7        ← 1.250 كجم من الصنف 1234

الصيغة تختلف بين الموازين، فهي إعداد واحد للمحل (طول الكود، الوزن أم السعر، عدد الكسور).
نفس المنطق مكتوب في الواجهة (lib/scaleBarcode.ts) لأن الكاشير يقرأ من الكتالوج المحلي فوراً.
"""

from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EAN13_LENGTH = 13
QTY_SCALE = 1000
MONEY_SCALE = 100
MAX_PREFIXES = 10
DEFAULT_PREFIXES = ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"]


class ScaleMode(StrEnum):
    WEIGHT = "weight"  # الملصق يحمل الوزن (الأشهر)
    PRICE = "price"  # الملصق يحمل السعر النهائي، والكمية = السعر ÷ سعر الكيلو


class ScaleBarcodeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    prefixes: list[str] = Field(default_factory=lambda: list(DEFAULT_PREFIXES), max_length=MAX_PREFIXES)
    code_length: int = Field(5, ge=3, le=6)
    mode: ScaleMode = ScaleMode.WEIGHT
    value_length: int = Field(5, ge=4, le=6)
    # الوزن: 3 = جرامات (01250 = 1.250 كجم). السعر: 2 = قروش (01250 = 12.50).
    value_decimals: int = Field(3, ge=0, le=3)
    check_digit: bool = True  # التحقق من رقم EAN-13 الأخير (يكتشف أخطاء القراءة)

    @field_validator("prefixes")
    @classmethod
    def _prefixes(cls, value: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(p.strip() for p in value if p.strip()))
        if not cleaned:
            raise ValueError("أدخل بادئة واحدة على الأقل (مثل 20)")
        if any(not p.isdigit() or not 1 <= len(p) <= 3 for p in cleaned):
            raise ValueError("البادئة أرقام فقط من 1 إلى 3 خانات (مثل 20 أو 2)")
        if len({len(p) for p in cleaned}) != 1:
            raise ValueError("كل البادئات يجب أن تكون بنفس الطول")
        return cleaned

    @model_validator(mode="after")
    def _fits(self):
        used = len(self.prefixes[0]) + self.code_length + self.value_length
        if used > EAN13_LENGTH - 1:
            raise ValueError(
                f"البادئة + الكود + القيمة = {used} خانة، والحد 12 (الخانة 13 للتحقق)"
            )
        if self.mode is ScaleMode.PRICE and self.value_decimals > 2:
            raise ValueError("السعر لا يقبل أكثر من خانتين عشريتين")
        return self


@dataclass(frozen=True, slots=True)
class ScaleRead:
    scale_code: int
    qty: int | None  # × 1000 (وضع الوزن)
    amount: int | None  # قروش (وضع السعر)


def ean13_valid(code: str) -> bool:
    if len(code) != EAN13_LENGTH or not code.isdigit():
        return False
    digits = [int(c) for c in code]
    total = sum(d * (3 if i % 2 else 1) for i, d in enumerate(digits[:12]))
    return (10 - total % 10) % 10 == digits[12]


def parse_scale_barcode(code: str, cfg: ScaleBarcodeConfig) -> ScaleRead | None:
    """None = ليس باركود ميزان بهذه الصيغة (يُعامل كباركود عادي)."""
    if not cfg.enabled or len(code) != EAN13_LENGTH or not code.isdigit():
        return None
    plen = len(cfg.prefixes[0])
    if code[:plen] not in cfg.prefixes:
        return None
    if cfg.check_digit and not ean13_valid(code):
        return None
    start = plen + cfg.code_length
    scale_code = int(code[plen:start])
    value = int(code[start : start + cfg.value_length])
    if scale_code <= 0 or value <= 0:
        return None
    if cfg.mode is ScaleMode.WEIGHT:
        return ScaleRead(scale_code, value * 10 ** (3 - cfg.value_decimals), None)
    return ScaleRead(scale_code, None, value * 10 ** (2 - cfg.value_decimals))
