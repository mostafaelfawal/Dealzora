"""QR الإيصال المطبوع وبيانات المنظومة على الورق. المصدر: الـ SDK، receiptissuancefaq، قسم «Receipt QR Code»:

  URL:      {eInvoicingPortalURL}/receipts/search/{UUID}/share/{ReceiptDateAndTime}
            «{ReceiptDateAndTime} is the receipt issuance date and time in UTC»
  المحتوى:  {URL}#Total:{Total},IssuerRIN:{Registration Number}   («in one line text»)
  المثال الرسمي حرفياً:
    http://invoicing.eta.gov.eg/receipts/search/68e6…f320/share/2022-02-19T02:00Z#Total:1000.000,IssuerRIN:674859545

قرار المرحلة 6 (يُعدَّل هنا فقط بعد التجربة على البيئة التجريبية):
  - الوقت بالدقائق UTC مثل المثال (2022-02-19T02:00Z)، والإجمالي بثلاث منازل مثل المثال (1000.000).
  - الرابط https من جدول البيئات (/faq/) بدل http في المثال، وبوابة البيئة المختارة (تجريبية/فعلية).
القيم كلها من نص المستند المخزّن نفسه (لا إعادة حساب): التاريخ والإجمالي والـ RIN كما أُصدرت.
الـ SDK لا يحدد حجم الـ QR ولا مستوى تصحيح الخطأ: نستخدم M (تحمّل ~15% تلف) والواجهة ترسمه بنقاط الطابعة.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache

import segno

from app.modules.eta.constants import EtaEnvironment

from .environments import ENVIRONMENTS

QR_ERROR_LEVEL = "m"
# قناع ثابت: اختيار القناع التلقائي يقيّم الأقنعة الثمانية (~20ms في كل بيع). جُرّب كل قناع على 30 محتوى
# × ورق 58 و80مم × 10 لقطات كاميرا محاكاة: القراءة 100% للتلقائي ولكل قناع ثابت (مراجعة ما قبل الإطلاق).
QR_MASK = 2
URL_TIME_FORMAT = "%Y-%m-%dT%H:%MZ"  # مثل المثال الرسمي: دقائق بلا ثوانٍ
TOTAL_FORMAT = Decimal("0.001")  # مثل المثال الرسمي: 1000.000


@dataclass(frozen=True, slots=True)
class PrintData:
    uuid: str
    receipt_number: str
    rin: str
    trade_name: str
    branch_code: str
    device_serial: str
    issued_at: str  # dateTimeIssued كما في المستند
    qr_content: str
    qr_url: str  # الجزء قبل # (رابط التحقق لواتساب)
    qr_modules: list[str]  # صفوف المصفوفة بلا هامش: "1" داكن و"0" فاتح
    reference_uuid: str | None  # للمرتجع: UUID فاتورة البيع الأصلية


def verification_url(environment: EtaEnvironment, uuid: str, issued: str) -> str:
    moment = datetime.strptime(issued, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    portal = ENVIRONMENTS[environment].portal_url
    return f"{portal}/receipts/search/{uuid}/share/{moment.strftime(URL_TIME_FORMAT)}"


def qr_content(environment: EtaEnvironment, uuid: str, issued: str, total: Decimal, rin: str) -> str:
    url = verification_url(environment, uuid, issued)
    return f"{url}#Total:{total.quantize(TOTAL_FORMAT, rounding=ROUND_HALF_UP)},IssuerRIN:{rin}"


def qr_modules(content: str) -> list[str]:
    """مصفوفة الـ QR بلا الهامش الصامت (الواجهة تضيفه بالحجم المناسب لنقاط الطابعة)."""
    return list(_matrix(content))


@lru_cache(maxsize=64)  # إعادة الطباعة/المعاينة لنفس الإيصال لا تعيد الحساب
def _matrix(content: str) -> tuple[str, ...]:
    code = segno.make(content, error=QR_ERROR_LEVEL, micro=False, boost_error=False, mode="byte", mask=QR_MASK)
    return tuple("".join("1" if cell else "0" for cell in row) for row in code.matrix)


def print_data(document_text: str, environment: EtaEnvironment) -> PrintData:
    """كل ما يُطبع من المستند المخزّن (لقطة وقت الإصدار، لا الإعدادات الحالية)."""
    doc = json.loads(document_text, parse_float=Decimal, parse_int=Decimal)
    header, seller = doc["header"], doc["seller"]
    total = Decimal(str(doc["totalAmount"]))
    content = qr_content(environment, header["uuid"], header["dateTimeIssued"], total, seller["rin"])
    return PrintData(
        uuid=header["uuid"],
        receipt_number=header["receiptNumber"],
        rin=seller["rin"],
        trade_name=seller["companyTradeName"],
        branch_code=seller["branchCode"],
        device_serial=seller["deviceSerialNumber"],
        issued_at=header["dateTimeIssued"],
        qr_content=content,
        qr_url=content.split("#", 1)[0],
        qr_modules=qr_modules(content),
        reference_uuid=header.get("referenceUUID"),
    )
