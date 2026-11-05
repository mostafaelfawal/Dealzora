import type {
  CashDirection,
  CashKind,
  TreasuryDirectionFilter,
  TreasuryKindFilter,
  TreasuryPeriod,
  TreasurySortKey,
} from "../types/treasury";

export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 12;

export const SORT_OPTIONS: { value: TreasurySortKey; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
  { value: "amount_desc", label: "الأعلى مبلغاً" },
  { value: "amount_asc", label: "الأقل مبلغاً" },
];

export const DIRECTION_OPTIONS: {
  id: TreasuryDirectionFilter;
  label: string;
}[] = [
  { id: "all", label: "الكل" },
  { id: "in", label: "داخل" },
  { id: "out", label: "خارج" },
];

export const KIND_OPTIONS: { value: TreasuryKindFilter; label: string }[] = [
  { value: "all", label: "كل الأنواع" },
  { value: "expense", label: "مصروفات" },
  { value: "manual_in", label: "إيداع يدوي" },
  { value: "manual_out", label: "سحب يدوي" },
];

export const PERIOD_OPTIONS: { value: TreasuryPeriod; label: string }[] = [
  { value: "all", label: "كل الفترات" },
  { value: "today", label: "اليوم" },
  { value: "week", label: "آخر 7 أيام" },
  { value: "month", label: "هذا الشهر" },
];

export const KIND_LABEL: Record<CashKind, string> = {
  expense: "مصروف",
  manual_in: "إيداع يدوي",
  manual_out: "سحب يدوي",
};

/** اقتراحات سريعة لسبب الحركة اليدوية. */
export const NOTE_PRESETS: Record<CashDirection, readonly string[]> = {
  in: ["رصيد افتتاحي", "تمويل من المالك", "إيداع من البنك"],
  out: ["سحب شخصي", "إيداع في البنك", "تسوية جرد"],
};
