"""خطط Dealzora وحدودها. المصدر الوحيد للحقيقة في الـ backend (الواجهة تقرأه من GET /plan).

الخطة يمررها Rust عند تشغيل الـ backend (POS_PLAN) من الترخيص المحلي:
- بلا ترخيص مدفوع ← «بَسطة» المجانية للأبد بحدودها.
- ترخيص مدفوع ← خطته (التراخيص القديمة بلا خطة = كل الميزات).
الإنفاذ هنا (لا في الواجهة فقط): أي طلب يتجاوز الخطة يُرفض برسالة ترقية واضحة.
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
    EXPIRY = "expiry"  # تتبع الصلاحية والدفعات (سلسلة)


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
}

# بَسطة: المالك يبيع بنفسه على جهاز واحد.
FREE_LIMITS = {"products": 300, "users": 1, "report_days": 7}
# أقل خطة مدفوعة تفتح الميزة (لرسالة الترقية). سجل العمليات وأجهزة الكاشير من «سوق».
_UNLOCKED_IN: dict[Feature, Plan] = {f: Plan.BASIC for f in Feature} | {
    Feature.AUDIT_LOG: Plan.PRO,
    Feature.TERMINALS: Plan.PRO,
    Feature.EXPIRY: Plan.ENTERPRISE,
}

_RANK = {Plan.FREE: 0, Plan.BASIC: 1, Plan.PRO: 2, Plan.ENTERPRISE: 3}
# ميزات تُفرض بالخطة فعلاً (الباقي: أي خطة مدفوعة تفتحه، كما كان قبل التقسيم).
_STRICT = frozenset({Feature.EXPIRY})


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
        return Plan.FREE
    return plan


def is_free() -> bool:
    return current_plan() is Plan.FREE


def has_feature(feature: Feature) -> bool:
    # أي خطة مدفوعة = كل الميزات، ما عدا _STRICT فتحتاج خطتها أو أعلى.
    plan = current_plan()
    if feature in _STRICT:
        return _RANK[plan] >= _RANK[_UNLOCKED_IN[feature]]
    return plan is not Plan.FREE


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
    return ForbiddenError(
        "plan_limit_reached",
        f"وصلت لحد خطة «{PLAN_NAMES[Plan.FREE]}» المجانية ({limit} {what}). رقِّ خطتك للمزيد.",
        {"limit": limit, "plan": current_plan().value},
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
