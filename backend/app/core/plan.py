"""خطط Dealzora وحدودها. المصدر الوحيد للحقيقة في الـ backend (الواجهة تقرأه من GET /plan).

الخطة يمررها Rust عند تشغيل الـ backend (POS_PLAN) من الترخيص المحلي:
- بلا ترخيص مدفوع ← «بَسطة» المجانية للأبد بحدودها.
- ترخيص مدفوع ← خطته (التراخيص القديمة بلا خطة = كل الميزات).
الإنفاذ هنا (لا في الواجهة فقط): أي طلب يتجاوز الخطة يُرفض برسالة ترقية واضحة.

كل ميزة تُفتح من خطة معيّنة وما فوقها (_UNLOCKED_IN)، وكل خطة لها حدودها (PLAN_LIMITS).
نفس الجدول في الواجهة: frontend/lib/plan.ts (FEATURE_INFO) وصفحة الخطط features/settings/config/plans.ts.
"""

import time
from enum import StrEnum
from typing import Annotated

from fastapi import Depends, Request

from .config import get_settings
from .errors import ForbiddenError


class Plan(StrEnum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


PLAN_NAMES: dict[Plan, str] = {
    Plan.FREE: "بَسطة",
    Plan.BASIC: "دُكّان",
    Plan.PRO: "سوق",
    Plan.ENTERPRISE: "سلسلة",
}


class Feature(StrEnum):
    CUSTOMERS = "customers"  # العملاء والآجل والتحصيل
    WALLETS = "wallets"  # الدفع الإلكتروني (محافظ/بطاقات/تحويلات حسب الدولة)
    SUPPLIERS = "suppliers"  # الموردين والمشتريات
    EXPENSES = "expenses"  # المصروفات وحركات الخزنة اليدوية
    EXTRA_UNITS = "extra_units"  # كرتونة/دستة
    BARCODE_LABELS = "barcode_labels"
    EXCEL = "excel"  # استيراد وتصدير
    WHATSAPP = "whatsapp"
    BACKUP_LOCATION = "backup_location"  # مكان النسخ + الاستعادة من ملف
    AUDIT_LOG = "audit_log"
    FULL_REPORTS = "full_reports"  # التقارير أبعد من 7 أيام + تقرير الديون
    MULTI_USER = "multi_user"
    TERMINALS = "terminals"  # أجهزة كاشير إضافية
    EXPIRY = "expiry"  # تتبع الصلاحية والدفعات (سوق)
    BRANCHES = "branches"  # تعدد الفروع وتحويل المخزون بينها (سلسلة)
    E_RECEIPT = "e_receipt"  # الإيصال الإلكتروني - منظومة الضرائب المصرية (سوق)
    SCALE_BARCODE = "scale_barcode"  # باركود الميزان للأصناف الموزونة (سوق)
    PROMOTIONS = "promotions"  # العروض التلقائية (سوق)
    WHOLESALE = "wholesale"  # أسعار الجملة وعملاء الجملة (سوق)
    PURCHASE_ORDERS = "purchase_orders"  # طلبات الشراء من النواقص (سوق)
    LOYALTY = "loyalty"  # نقاط ولاء العملاء (سوق)
    STATEMENT_PDF = "statement_pdf"  # كشف حساب العميل PDF وإرساله على واتساب (سوق)
    INSTALLMENTS = "installments"  # نظام التقسيط بجدول أقساط ومتابعة المتأخر (سوق)


FEATURE_NAMES: dict[Feature, str] = {
    Feature.CUSTOMERS: "العملاء والبيع الآجل",
    Feature.WALLETS: "الدفع الإلكتروني (محافظ وبطاقات وتحويلات)",
    Feature.SUPPLIERS: "الموردين والمشتريات",
    Feature.EXPENSES: "المصروفات والخزنة",
    Feature.EXTRA_UNITS: "وحدات البيع الإضافية (كرتونة/دستة)",
    Feature.BARCODE_LABELS: "طباعة ملصقات الباركود",
    Feature.EXCEL: "الاستيراد والتصدير من Excel",
    Feature.WHATSAPP: "إرسال الفاتورة على واتساب",
    Feature.BACKUP_LOCATION: "اختيار مكان النسخ والاستعادة من ملف",
    Feature.AUDIT_LOG: "سجل العمليات",
    Feature.FULL_REPORTS: "التقارير الكاملة",
    Feature.MULTI_USER: "أكثر من مستخدم",
    Feature.TERMINALS: "أجهزة كاشير إضافية",
    Feature.EXPIRY: "تتبع الصلاحية والدفعات",
    Feature.BRANCHES: "تعدد الفروع وتحويل المخزون",
    Feature.E_RECEIPT: "الإيصال الإلكتروني - منظومة الضرائب",
    Feature.SCALE_BARCODE: "باركود الميزان",
    Feature.PROMOTIONS: "العروض التلقائية",
    Feature.WHOLESALE: "أسعار الجملة",
    Feature.PURCHASE_ORDERS: "طلبات الشراء من النواقص",
    Feature.LOYALTY: "نقاط الولاء",
    Feature.STATEMENT_PDF: "كشف حساب العميل PDF على واتساب",
    Feature.INSTALLMENTS: "نظام التقسيط",
}

_RANK = {Plan.FREE: 0, Plan.BASIC: 1, Plan.PRO: 2, Plan.ENTERPRISE: 3}

# أقل خطة تفتح الميزة. الافتراضي «دُكّان»، والباقي حسب صفحة الخطط.
_UNLOCKED_IN: dict[Feature, Plan] = {f: Plan.BASIC for f in Feature} | {
    Feature.AUDIT_LOG: Plan.PRO,
    Feature.TERMINALS: Plan.PRO,
    Feature.EXPIRY: Plan.PRO,
    Feature.E_RECEIPT: Plan.PRO,
    Feature.SCALE_BARCODE: Plan.PRO,
    Feature.PROMOTIONS: Plan.PRO,
    Feature.WHOLESALE: Plan.PRO,
    Feature.PURCHASE_ORDERS: Plan.PRO,
    Feature.LOYALTY: Plan.PRO,
    Feature.STATEMENT_PDF: Plan.PRO,
    Feature.INSTALLMENTS: Plan.PRO,
    Feature.BRANCHES: Plan.ENTERPRISE,
}

# حدود كل خطة (None = بلا حد). المستخدمون يشملون المالك.
# عدد أجهزة الكاشير يحدده الترخيص الموقّع نفسه (max_terminals)، لا هنا.
PLAN_LIMITS: dict[Plan, dict[str, int | None]] = {
    Plan.FREE: {"products": 300, "users": 1, "report_days": 7},  # بَسطة: المالك يبيع بنفسه
    Plan.BASIC: {"products": None, "users": 4, "report_days": 366},  # دُكّان: المالك + مدير + 2 كاشير، وسنة
    Plan.PRO: {"products": None, "users": None, "report_days": None},
    Plan.ENTERPRISE: {"products": None, "users": None, "report_days": None},
}
# توافق مع الكود القديم: حدود «بَسطة».
FREE_LIMITS = PLAN_LIMITS[Plan.FREE]


def unlocked_in(feature: Feature) -> Plan:
    return _UNLOCKED_IN[feature]


def current_plan() -> Plan:
    """المصدر الأحدث: عقد الترخيص الموقّع الذي يجدده البرنامج كل دقيقتين (ويُرسل فور التفعيل)،
    وإلا POS_PLAN الذي مرّره Rust عند التشغيل."""
    from app.modules.devices.runtime import active_lease  # متأخر: تفادي الاستيراد الدائري

    settings = get_settings()
    lease = active_lease()
    if lease is not None and lease.plan is not None:
        raw, expires_at = lease.plan, lease.plan_expires_at or None
    else:
        raw, expires_at = settings.plan, settings.plan_expires_at
    try:
        plan = Plan(raw)
    except ValueError:
        return Plan.FREE  # قيمة غير معروفة = الأضيق (لا نفتح ميزة بالخطأ)
    # الاشتراك انتهى والبرنامج مفتوح: نكمل على «بَسطة» (البيع لا يتوقف، والمدفوع يُقفل).
    if plan is not Plan.FREE and expires_at and time.time() >= expires_at:
        plan = Plan.FREE
    # جهاز فرع مربوط بمحل خطته أعلى: يرث خطة المحل (شهادة موقّعة من سيرفر الفروع).
    from .branch_lease import current_plan as lease_plan  # متأخر: لا دوران

    try:
        inherited = Plan(lease_plan() or "")
    except ValueError:
        return plan
    return inherited if _RANK[inherited] > _RANK[plan] else plan


def is_free() -> bool:
    return current_plan() is Plan.FREE


def plan_allows(plan: Plan, feature: Feature) -> bool:
    return _RANK[plan] >= _RANK[_UNLOCKED_IN[feature]]


def has_feature(feature: Feature) -> bool:
    return plan_allows(current_plan(), feature)


def plan_limit(key: str) -> int | None:
    """حد الخطة الحالية: products / users / report_days (None = بلا حد)."""
    return PLAN_LIMITS[current_plan()][key]


def enabled_features() -> list[Feature]:
    return [f for f in Feature if has_feature(f)]


def upgrade_error(feature: Feature) -> ForbiddenError:
    plan = PLAN_NAMES[_UNLOCKED_IN[feature]]
    current = current_plan()
    where = (
        f"خطة «{PLAN_NAMES[Plan.FREE]}» المجانية"
        if current is Plan.FREE
        else f"خطتك الحالية «{PLAN_NAMES[current]}»"
    )
    return ForbiddenError(
        "plan_upgrade_required",
        f"{FEATURE_NAMES[feature]} غير متاحة في {where}. متاحة من خطة «{plan}».",
        {"feature": feature.value, "plan": current_plan().value},
    )


def limit_error(what: str, limit: int) -> ForbiddenError:
    current = current_plan()
    where = (
        f"خطة «{PLAN_NAMES[Plan.FREE]}» المجانية" if current is Plan.FREE else f"خطة «{PLAN_NAMES[current]}»"
    )
    return ForbiddenError(
        "plan_limit_reached",
        f"وصلت لحد {where} ({limit} {what}). رقِّ خطتك للمزيد.",
        {"limit": limit, "plan": current.value},
    )


def ensure_feature(feature: Feature) -> None:
    if not has_feature(feature):
        raise upgrade_error(feature)


def require_feature(feature: Feature):  # noqa: ANN201 - dependency factory
    """الميزة كلها (قراءة وكتابة)، مثل سجل العمليات."""

    def dep() -> None:
        ensure_feature(feature)

    return Depends(dep)


def require_feature_for_writes(feature: Feature):  # noqa: ANN201
    """الكتابة فقط: القراءة تبقى (مثلاً قائمة العملاء الفارغة لشاشة الكاشير لا تتعطل)."""

    def dep(request: Request) -> None:
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            ensure_feature(feature)

    return Depends(dep)


PlanDep = Annotated[Plan, Depends(current_plan)]
