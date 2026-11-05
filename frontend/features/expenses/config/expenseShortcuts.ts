import { plain, type Shortcut } from "@/lib/shortcuts";

export const EXPENSES_SHORTCUTS = {
  focusSearch: { label: "F2", description: "البحث عن مصروف", match: plain("F2") },
  newExpense: { label: "F4", description: "مصروف جديد", match: plain("F4") },
  toggleView: {
    label: "F6",
    description: "التبديل بين البطاقات والجدول",
    match: plain("F6"),
  },
} as const satisfies Record<string, Shortcut>;