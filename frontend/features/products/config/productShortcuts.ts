import { ctrl, ENTER, plain, type Shortcut } from "@/lib/shortcuts";

/** للتوافق مع أي import قديم. */
export type ProductShortcut = Shortcut;

/** اختصارات صفحة المنتجات. (F1 محجوز لـ "بيع جديد" في الـ Header.) */
export const PRODUCTS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "البحث عن صنف",
    match: plain("F2"),
  },
  importExcel: {
    label: "F3",
    description: "استيراد من Excel",
    match: plain("F3"),
  },
  newProduct: {
    label: "F4",
    description: "إضافة صنف جديد",
    match: plain("F4"),
  },
  toggleView: {
    label: "F6",
    description: "التبديل بين البطاقات والجدول",
    match: plain("F6"),
  },
  exportExcel: {
    label: "F7",
    description: "تصدير إلى Excel",
    match: plain("F7"),
  },
} as const satisfies Record<string, Shortcut>;

/** اختصارات صفحة إضافة/تعديل صنف. */
export const PRODUCT_FORM_SHORTCUTS = {
  save: {
    label: "Ctrl+S",
    description: "حفظ الصنف",
    match: ctrl("KeyS"),
  },
  saveAndNew: {
    label: "Ctrl+Enter",
    description: "حفظ وإضافة صنف آخر",
    match: ctrl(ENTER),
  },
} as const satisfies Record<string, Shortcut>;
