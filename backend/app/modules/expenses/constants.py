"""ثوابت موديول المصروفات. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

# ---- الحدود (طابقها مع frontend/features/expenses/config/expenseLimits و expenseOptions) ----
MAX_NOTE_LEN = 200  # NOTE_MAX
MAX_MONEY = 10_000_000 * 100  # AMOUNT_MAX بالجنيه × 100 = قروش
MAX_CATEGORY_LEN = 24
MAX_QUERY_LEN = 100
DEFAULT_PAGE_SIZE = 24  # DEFAULT_PAGE_SIZE في expenseOptions
MAX_PAGE_SIZE = 500
MAX_BULK_ITEMS = 200  # أقصى عدد عناصر في طلب جماعي واحد
WEEK_DAYS = 7  # "آخر 7 أيام" شامل اليوم

# ---- أسماء الكيانات (للـ Outbox والـ Audit) ----
ENTITY_EXPENSE = "expense"

EXPENSE_SNAPSHOT_FIELDS = ("category", "amount", "note", "spent_at")

# أسماء البنود في ملاحظة حركة الخزنة (طابقها مع EXPENSE_CATEGORIES في الواجهة)
CATEGORY_LABELS = {
    "rent": "إيجار",
    "electricity": "كهرباء",
    "water": "مياه",
    "salaries": "رواتب",
    "transport": "نقل ومواصلات",
    "maintenance": "صيانة",
    "supplies": "مستلزمات",
    "marketing": "دعاية وتسويق",
    "taxes": "ضرائب ورسوم",
    "other": "مصروفات أخرى",
}


class ExpenseError(StrEnum):
    NOT_FOUND = "expense_not_found"
    VERSION_CONFLICT = "version_conflict"


ERROR_MESSAGES: dict[ExpenseError, str] = {
    ExpenseError.NOT_FOUND: "لم نجد هذا المصروف",
    ExpenseError.VERSION_CONFLICT: "تم تعديل هذا المصروف من مكان آخر. حدّث الصفحة وأعد المحاولة",
}