export interface ProductShortcut {
  label: string;
  description: string;
  match: (event: KeyboardEvent) => boolean;
}

const plainKey = (key: string) => (event: KeyboardEvent) =>
  event.key === key &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.metaKey &&
  !event.shiftKey;

/** Ctrl/⌘ + حرف بـ event.code ليعمل مع لوحة المفاتيح العربية. */
const ctrlCode = (code: string) => (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.code === code;

/** اختصارات صفحة المنتجات. (F1 محجوز لـ "بيع جديد" في الـ Header.) */
export const PRODUCTS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "البحث عن صنف",
    match: plainKey("F2"),
  },
  importExcel: {
    label: "F3",
    description: "استيراد من Excel",
    match: plainKey("F3"),
  },
  newProduct: {
    label: "F4",
    description: "إضافة صنف جديد",
    match: plainKey("F4"),
  },
  toggleView: {
    label: "F6",
    description: "التبديل بين البطاقات والجدول",
    match: plainKey("F6"),
  },
} as const satisfies Record<string, ProductShortcut>;

/** اختصارات صفحة إضافة/تعديل صنف. */
export const PRODUCT_FORM_SHORTCUTS = {
  save: {
    label: "Ctrl+S",
    description: "حفظ الصنف",
    match: ctrlCode("KeyS"),
  },
  saveAndNew: {
    label: "Ctrl+Enter",
    description: "حفظ وإضافة صنف آخر",
    match: (event: KeyboardEvent) =>
      (event.ctrlKey || event.metaKey) && event.key === "Enter",
  },
} as const satisfies Record<string, ProductShortcut>;
