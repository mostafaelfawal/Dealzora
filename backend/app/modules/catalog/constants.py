"""ثوابت موديول الكتالوج (الأقسام ووحدات القياس)."""

from enum import StrEnum

from app.modules.products.constants import MAX_UNIT_NAME_LEN

MAX_CATEGORY_NAME_LEN = 80
MAX_UNIT_LEN = MAX_UNIT_NAME_LEN  # نفس طول اسم الوحدة في الصنف

# ---- أسماء الكيانات (للـ Outbox والـ Audit) ----
ENTITY_CATEGORY = "category"
ENTITY_MEASURE_UNIT = "measure_unit"

CATEGORY_SNAPSHOT_FIELDS = ("name", "sort_order")
UNIT_SNAPSHOT_FIELDS = ("name", "allow_decimal", "sort_order")

# الوحدات الافتراضية عند أول تشغيل: (الاسم، تقبل كسوراً). طابقها مع الواجهة.
DEFAULT_UNITS: tuple[tuple[str, bool], ...] = (
    ("قطعة", False),
    ("كجم", True),
    ("جرام", True),
    ("لتر", True),
    ("متر", True),
    ("علبة", False),
    ("كيس", False),
    ("زجاجة", False),
    ("عبوة", False),
    ("كرتونة", False),
    ("دستة", False),
)


class CategoryError(StrEnum):
    NOT_FOUND = "category_not_found"
    NAME_TAKEN = "category_name_taken"
    VERSION_CONFLICT = "version_conflict"


class UnitError(StrEnum):
    NOT_FOUND = "unit_not_found"
    NAME_TAKEN = "unit_name_taken"
    IN_USE = "unit_in_use"
    NAME_CLASH = "unit_name_clash"
    VERSION_CONFLICT = "version_conflict"


CATEGORY_MESSAGES: dict[CategoryError, str] = {
    CategoryError.NOT_FOUND: "القسم غير موجود",
    CategoryError.NAME_TAKEN: "يوجد قسم آخر بنفس الاسم",
    CategoryError.VERSION_CONFLICT: "تم تعديل هذا القسم من مكان آخر. حدّث الصفحة وأعد المحاولة",
}

UNIT_MESSAGES: dict[UnitError, str] = {
    UnitError.NOT_FOUND: "الوحدة غير موجودة",
    UnitError.NAME_TAKEN: "توجد وحدة أخرى بنفس الاسم",
    UnitError.IN_USE: "لا يمكن حذف وحدة مستخدمة في أصناف. غيّر وحدة هذه الأصناف أولاً",
    UnitError.NAME_CLASH: "صنف يستخدم الاسم الجديد كوحدة أخرى بالفعل، فلا يمكن إعادة التسمية",
    UnitError.VERSION_CONFLICT: "تم تعديل هذه الوحدة من مكان آخر. حدّث الصفحة وأعد المحاولة",
}
