"""ثوابت منظومة الإيصال الإلكتروني (مصلحة الضرائب المصرية). أي رقم أو نص ثابت يُكتب هنا فقط.

المرجع الوحيد: الـ SDK الرسمي https://sdk.invoicing.eta.gov.eg (اطلعنا عليه 2026-11-15):
- مصادقة جهاز الـ POS:  /ereceiptapi/01-authenticate-pos/
- هيكل الإيصال v1.2:    /documents/retail-receipt-v1-2/
الحدود القصوى للأطوال أدناه منقولة من جداول هاتين الصفحتين حرفياً.
"""

from enum import StrEnum

ENTITY_ETA = "eta"  # سجل التدقيق
ENTITY_ETA_DEVICE = "eta_device"

SDK_URL = "https://sdk.invoicing.eta.gov.eg"


class EtaEnvironment(StrEnum):
    PREPROD = "preprod"  # البيئة التجريبية (pre-production)
    PROD = "prod"  # الفعلية (production)


class ItemType(StrEnum):
    """itemType في ItemData: «Must be GS1 or EGS for this version» (retail-receipt-v1-2)."""

    EGS = "EGS"
    GS1 = "GS1"


# ---- seller (retail-receipt-v1-2، جدول Seller) ----
MAX_RIN = 30  # rin
MAX_TRADE_NAME = 200  # companyTradeName
MAX_BRANCH_CODE = 50  # branchCode
MAX_ACTIVITY_CODE = 10  # activityCode
MAX_DEVICE_SERIAL = 100  # deviceSerialNumber

# ---- branchAddress (retail-receipt-v1-2، جدول BranchAddress) ----
ADDRESS_COUNTRY = "EG"  # «Must be EG for internal business issuers»
MAX_GOVERNATE = 100
MAX_REGION_CITY = 100
MAX_STREET = 200
MAX_BUILDING_NUMBER = 100
MAX_POSTAL_CODE = 30
MAX_FLOOR = 100
MAX_ROOM = 100
MAX_LANDMARK = 500
MAX_ADDITIONAL_INFO = 500

# ---- مصادقة الجهاز (01-authenticate-pos: body + header) ----
MAX_CLIENT_ID = 100  # client_id
MAX_CLIENT_SECRET = 100  # client_secret
MAX_POS_SERIAL = 100  # header posserial
MAX_POS_OS_VERSION = 50  # header pososversion
MAX_POS_MODEL_FRAMEWORK = 10  # header posmodelframework
MAX_PRESHARED_KEY = 200  # header presharedkey

# ---- ItemData ----
MAX_ITEM_CODE = 100  # itemCode
MAX_UNIT_TYPE = 30  # unitType

# اقتراحات ربط أسماء الوحدات الشائعة بأكواد جدول الوحدات (codes/UnitTypes.json).
# اقتراح فقط يراجعه المدير ويحفظه بنفسه، وكل كود هنا يُتحقق من وجوده في الجدول عند التحميل.
UNIT_SUGGESTIONS: dict[str, str] = {
    "قطعة": "EA",
    "كيلو": "KGM",
    "كجم": "KGM",
    "كيلوجرام": "KGM",
    "جرام": "GRM",
    "لتر": "LTR",
    "متر": "M",
    "كرتونة": "CT",
    "كرتونه": "CT",
    "دستة": "DZN",
    "علبة": "BOX",
    "صندوق": "BOX",
    "عبوة": "PK",
    "باكو": "PK",
    "كيس": "BG",
    "زجاجة": "BO",
}

MAIN_DEVICE_NAME = "الجهاز الأساسي"
SAMPLE_LIMIT = 10  # أقصى عدد أمثلة (أسماء أصناف/وحدات) في بند الجاهزية


class EtaError(StrEnum):
    NOT_READY = "eta_not_ready"
    DEVICE_NOT_FOUND = "eta_device_not_found"
    UNIT_NOT_FOUND = "eta_unit_not_found"
    UNKNOWN_UNIT_CODE = "eta_unknown_unit_code"
    UNKNOWN_ACTIVITY_CODE = "eta_unknown_activity_code"
    UNKNOWN_TABLE = "eta_unknown_table"
    SERIAL_TAKEN = "eta_serial_taken"


ERROR_MESSAGES: dict[EtaError, str] = {
    EtaError.NOT_READY: "لا يمكن تفعيل الإيصال الإلكتروني قبل استكمال البيانات الناقصة (عدد البنود: {count}). راجع قائمة الجاهزية",
    EtaError.DEVICE_NOT_FOUND: "الجهاز غير موجود أو أُلغي اقترانه",
    EtaError.UNIT_NOT_FOUND: "الوحدة غير موجودة",
    EtaError.UNKNOWN_UNIT_CODE: "كود الوحدة ({code}) غير موجود في جدول وحدات المنظومة",
    EtaError.UNKNOWN_ACTIVITY_CODE: "كود النشاط ({code}) غير موجود في جدول أنشطة المنظومة",
    EtaError.UNKNOWN_TABLE: "جدول أكواد غير معروف",
    EtaError.SERIAL_TAKEN: "الرقم التسلسلي ({serial}) مسجّل لجهاز آخر",
}
