"""طرق الدفع الإلكتروني التي يحددها المحل (محافظ، بطاقات، تحويلات فورية).

الكاش والآجل والمختلط مدمجة في النظام. أي طريقة أخرى يضيفها المدير من الإعدادات
(من قالب دولته أو يدوياً) وتُحفظ JSON في app_settings تحت المفتاح payments.methods.

معرّف الطريقة (مثل vodafone_cash أو stc_pay) يُخزَّن كما هو في sales.payment_method،
ومعه لقطة الاسم وقت البيع (sales.payment_label) فلا تتأثر الفواتير القديمة بإعادة التسمية أو الحذف.

كل الطرق الإلكترونية لها نفس منطق المال: المبلغ كامل بلا باقٍ، ولا يدخل الدرج.
"""

import re
from enum import StrEnum

# الطرق المدمجة (لها منطق خاص في الدرج والآجل).
BUILTIN_LABELS: dict[str, str] = {"cash": "كاش", "credit": "آجل", "mixed": "مختلط"}

# أسماء احتياطية لطرق قديمة سُجلت قبل لقطة الاسم (فواتير ما قبل هذا الإصدار).
LEGACY_LABELS: dict[str, str] = {"vodafone_cash": "فودافون كاش", "instapay": "إنستاباي"}

METHOD_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,15}$")  # يناسب عمود payment_method (16)
RESERVED_IDS = frozenset({*BUILTIN_LABELS, "wallet", "all"})

MAX_METHODS = 12
MAX_METHOD_NAME = 40
MAX_METHOD_ACCOUNT = 60
MAX_COUNTRY_LEN = 3


class PaymentKind(StrEnum):
    """للعرض والأيقونات فقط؛ منطق المال واحد لكل الأنواع."""

    WALLET = "wallet"  # محفظة موبايل: فودافون كاش، STC Pay، زين كاش
    CARD = "card"  # بطاقة / نقطة بيع: مدى، KNET، بنفت
    TRANSFER = "transfer"  # تحويل فوري / بنكي: إنستاباي، CliQ، بريدي موب


def is_electronic(method: str) -> bool:
    return method not in BUILTIN_LABELS


def method_label(method: str, snapshot: str | None = None, names: dict[str, str] | None = None) -> str:
    """اسم الطريقة للعرض: المدمجة ← لقطة الفاتورة ← الإعدادات الحالية ← الأسماء القديمة ← المعرّف."""
    if method in BUILTIN_LABELS:
        return BUILTIN_LABELS[method]
    return snapshot or (names or {}).get(method) or LEGACY_LABELS.get(method) or method
