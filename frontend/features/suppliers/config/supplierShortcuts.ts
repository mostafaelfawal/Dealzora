import { ctrl, ENTER, plain, type Shortcut } from "@/lib/shortcuts";

/** اختصارات صفحة الموردين. (F1 محجوز لـ "بيع جديد" في الـ Header.) */
export const SUPPLIERS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "البحث عن مورد",
    match: plain("F2"),
  },
  newSupplier: {
    label: "F4",
    description: "إضافة مورد جديد",
    match: plain("F4"),
  },
  toggleView: {
    label: "F6",
    description: "التبديل بين البطاقات والجدول",
    match: plain("F6"),
  },
} as const satisfies Record<string, Shortcut>;

/** اختصارات صفحة إضافة/تعديل مورد. */
export const SUPPLIER_FORM_SHORTCUTS = {
  save: {
    label: "Ctrl+S",
    description: "حفظ المورد",
    match: ctrl("KeyS"),
  },
  saveAndNew: {
    label: "Ctrl+Enter",
    description: "حفظ وإضافة مورد آخر",
    match: ctrl(ENTER),
  },
} as const satisfies Record<string, Shortcut>;
