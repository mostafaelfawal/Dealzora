import { plain } from "@/lib/shortcuts";

/** فئات العملات الشائعة لعدّ الدرج بسرعة (جنيه). */
export const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1] as const;

export const SHIFT_PAGE_SIZES = [12, 24, 48];

export const SHIFTS_SHORTCUTS = {
  toggleShift: { label: "F4", match: plain("F4") },
} as const;

export const SHIFT_LIMITS = {
  note: 200,
  denominationCount: 5,
  otherAmount: 10,
} as const;
