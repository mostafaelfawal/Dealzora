import type { SortKey } from "../types/product";

/* قائمة الوحدات نفسها يديرها المدير (features/catalog، endpoint /units). */

/** اقتراحات احتياطية للوحدات الإضافية لحين تحميل قائمة الوحدات. */
export const EXTRA_UNIT_PRESETS = ["كرتونة", "دستة", "علبة"];

export const MAX_EXTRA_UNITS = 5; // نفس الـ backend

export const PAGE_SIZES = [12, 24, 48, 96];

/** نسب الربح السريعة فوق سعر الشراء. */
export const MARKUP_PRESETS = [10, 20, 30, 50];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name_asc", label: "الاسم (أ - ي)" },
  { value: "newest", label: "الأحدث" },
  { value: "price_desc", label: "السعر الأعلى" },
  { value: "price_asc", label: "السعر الأقل" },
  { value: "stock_asc", label: "المخزون الأقل" },
  { value: "stock_desc", label: "المخزون الأعلى" },
  { value: "margin_desc", label: "هامش الربح الأعلى" },
];
