"""نص المستند (JSON) والتسلسل الموحّد (canonical) وحساب الـ UUID، حرفياً كما في الـ SDK.

التسلسل (https://sdk.invoicing.eta.gov.eg/document-serialization-approach/):
  - يُعالَج المستند تكرارياً من الجذر وبنفس ترتيب الخصائص في النص.
  - اسم كل خاصية بحروف كبيرة (culture invariant uppercase) بين علامتي تنصيص.
  - القيم البسيطة تؤخذ «بدون أي معالجة كما هي في المستند» بين علامتي تنصيص (0.0 تبقى 0.0).
  - الكائن: "NAME" ثم تسلسل خصائصه. المصفوفة: "NAME" مرة، ثم "NAME" قبل كل عنصر.
  مطابق حرفاً بحرف للمثال الرسمي one-doc.json → one-doc-serialized.json.txt (tests/fixtures/eta).

الـ UUID (https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/#how-to-generate-receipt-uuid):
  1) المستند كامل بما فيه previousUUID (و referenceUUID للمرتجع). 2) uuid = "".
  3) التسلسل في سطر واحد. 4) SHA-256. 5) 32 بايت ← 64 حرفاً hex. 6) هذا هو الـ UUID.
  حالة حروف الـ hex غير مذكورة في الـ SDK: نستخدم الصغيرة (مثل عيّنة BatchReceipt.json).

القيمة «كما هي في المستند»: لذلك نكتب نص الـ JSON مرة واحدة بدالة واحدة لتنسيق الأرقام (dumps)،
ونحسب التسلسل من هذا النص نفسه، ونخزّن النص النهائي ليُرسل بنفس البايتات في المرحلة 4.
"""

import hashlib
import json
from collections.abc import Mapping
from decimal import Decimal
from typing import Any


class RawNumber(str):
    """رقم بنصه الحرفي في المستند (لا float: 94.50 تبقى 94.50)."""


def format_decimal(value: Decimal) -> str:
    """تنسيق موحّد لأرقامنا: بلا أصفار زائدة وبلا صيغة علمية (14.00 → 14 ، 0.50000 → 0.5)."""
    text = format(value.normalize(), "f")
    return "0" if text in ("-0", "") else text


def _encode(value: Any) -> str:
    if isinstance(value, Mapping):
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + _encode(v) for k, v in value.items()) + "}"
    if isinstance(value, list | tuple):
        return "[" + ",".join(_encode(v) for v in value) + "]"
    if isinstance(value, Decimal):
        return format_decimal(value)
    if isinstance(value, RawNumber):
        return str(value)
    if isinstance(value, bool) or value is None:
        return json.dumps(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):  # لا نستخدم float في مستنداتنا؛ احتياط فقط
        return format_decimal(Decimal(repr(value)))
    return json.dumps(value, ensure_ascii=False)


def dumps(document: Mapping[str, Any]) -> str:
    """نص JSON مضغوط للمستند بترتيب الخصائص كما بُني (الترتيب يدخل في التسلسل)."""
    return _encode(document)


def loads(text: str) -> Any:
    """قراءة JSON مع إبقاء الأرقام بنصها الحرفي (للتسلسل)."""
    return json.loads(text, parse_float=RawNumber, parse_int=RawNumber)


def _scalar(value: Any) -> str:
    if value is None:
        return ""
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def _serialize(value: Any) -> str:
    if isinstance(value, Mapping):
        out: list[str] = []
        for name, item in value.items():
            key = '"' + name.upper() + '"'
            if isinstance(item, list):
                out.append(key + "".join(key + _serialize(element) for element in item))
            else:
                out.append(key + _serialize(item))
        return "".join(out)
    if isinstance(value, list):  # مصفوفة في الجذر (غير موجودة في الإيصال)
        return "".join(_serialize(element) for element in value)
    return '"' + _scalar(value) + '"'


def serialize_text(json_text: str) -> str:
    """التسلسل الموحّد لنص JSON (القيم كما هي حرفياً في النص)."""
    return _serialize(loads(json_text))


def uuid_of(json_text: str) -> str:
    """UUID مستند بنصه: uuid يُفرَّغ، ثم التسلسل، ثم SHA-256 بـ 64 حرف hex صغيرة."""
    document = loads(json_text)
    header = document.get("header")
    if not isinstance(header, dict):
        raise ValueError("المستند بلا header")
    header["uuid"] = ""
    return hashlib.sha256(_serialize(document).encode("utf-8")).hexdigest()


def seal(document: dict[str, Any]) -> tuple[str, str]:
    """(الـ UUID، النص النهائي) لمستند header.uuid فيه موجود (أي قيمة). النص النهائي = ما يُرسل حرفياً."""
    document["header"]["uuid"] = ""
    uuid = uuid_of(dumps(document))
    document["header"]["uuid"] = uuid
    return uuid, dumps(document)
