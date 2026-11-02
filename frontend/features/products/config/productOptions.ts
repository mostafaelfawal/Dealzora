import type { SortKey } from "../types/product";

/** وحدات البيع الأساسية الشائعة. */
export const BASE_UNITS = [
  "قطعة",
  "كجم",
  "لتر",
  "متر",
  "علبة",
  "كيس",
  "زجاجة",
  "عبوة",
];

/** وحدات بتقبل كسور غالباً: بنفعّل مفتاح الكسور تلقائياً عند اختيارها. */
export const DECIMAL_UNITS = new Set(["كجم", "لتر", "متر"]);

/** اقتراحات سريعة للوحدات الإضافية. */
export const EXTRA_UNIT_PRESETS = ["كرتونة", "دستة", "علبة"];

export const MAX_EXTRA_UNITS = 4;

/** نسب الربح السريعة فوق سعر الشراء. */
export const MARKUP_PRESETS = [10, 20, 30, 50];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "الاسم (أ - ي)" },
  { value: "price", label: "السعر الأعلى" },
  { value: "stock", label: "المخزون الأقل" },
  { value: "margin", label: "هامش الربح الأعلى" },
];
