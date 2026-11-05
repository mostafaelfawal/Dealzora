import { plain, type Shortcut } from "@/lib/shortcuts";

export type TreasuryShortcut = Shortcut;

export const TREASURY_SHORTCUTS = {
  newEntry: {
    label: "F4",
    description: "حركة جديدة (إيداع / سحب)",
    match: plain("F4"),
  },
  toggleView: {
    label: "F6",
    description: "تبديل العرض (بطاقات / جدول)",
    match: plain("F6"),
  },
} as const satisfies Record<string, Shortcut>;
