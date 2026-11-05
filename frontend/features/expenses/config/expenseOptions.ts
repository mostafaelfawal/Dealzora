import type { ExpensePeriod, ExpenseSortKey } from "../types/expense";

export const EXPENSES_SEARCH_ID = "expenses-search";

export const PAGE_SIZES = [12, 24, 48, 96];
export const DEFAULT_PAGE_SIZE = 24;

export const EXPENSE_CATEGORIES = [
  { id: "rent", label: "إيجار" },
  { id: "electricity", label: "كهرباء" },
  { id: "water", label: "مياه" },
  { id: "salaries", label: "رواتب" },
  { id: "transport", label: "نقل ومواصلات" },
  { id: "maintenance", label: "صيانة" },
  { id: "supplies", label: "مستلزمات" },
  { id: "marketing", label: "دعاية وإعلان" },
  { id: "taxes", label: "ضرائب ورسوم" },
  { id: "other", label: "أخرى" },
] as const;

export const SORT_OPTIONS: { value: ExpenseSortKey; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
  { value: "amount_desc", label: "الأعلى مبلغاً" },
  { value: "amount_asc", label: "الأقل مبلغاً" },
];

export const PERIOD_LABELS: Record<ExpensePeriod, string> = {
  all: "كل الفترات",
  today: "اليوم",
  week: "آخر 7 أيام",
  month: "هذا الشهر",
};