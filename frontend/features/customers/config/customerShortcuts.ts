import { plain, type Shortcut } from "@/lib/shortcuts";

export type CustomerShortcut = Shortcut;

export const CUSTOMERS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "البحث عن عميل",
    match: plain("F2"),
  },
  newCustomer: {
    label: "F4",
    description: "عميل جديد",
    match: plain("F4"),
  },
  toggleView: {
    label: "F6",
    description: "تبديل العرض (بطاقات / جدول)",
    match: plain("F6"),
  },
} as const satisfies Record<string, Shortcut>;
