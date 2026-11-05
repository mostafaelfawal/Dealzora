import type { CustomerFilter, CustomerSortKey } from "../types/customer";

/** عدد الأيام بدون أي دفعة (وعليه دين) حتى يُعتبر العميل متأخراً. */
export const OVERDUE_DAYS = 30;
/** نسبة استهلاك الحد الائتماني التي يظهر عندها تنبيه "قارب الحد". */
export const NEAR_LIMIT_RATIO = 0.8;

export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 12;

export const CUSTOMERS_SEARCH_ID = "customers-search";

export const SORT_OPTIONS: { value: CustomerSortKey; label: string }[] = [
  { value: "debt", label: "الأعلى مديونية" },
  { value: "name", label: "الاسم (أ - ي)" },
  { value: "recent", label: "آخر شراء" },
  { value: "sales", label: "الأكثر شراءً" },
  { value: "newest", label: "الأحدث إضافة" },
];

export const FILTER_OPTIONS: { id: CustomerFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "debtors", label: "عليهم دين" },
  { id: "overdue", label: "متأخرون" },
  { id: "limit", label: "بلغوا الحد" },
  { id: "inactive", label: "معطّلون" },
];

export const CREDIT_LIMIT_PRESETS = [0, 1000, 3000, 5000, 10000] as const;
