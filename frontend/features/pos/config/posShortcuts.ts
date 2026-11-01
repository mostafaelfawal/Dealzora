export interface PosShortcut {
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

/** اختصارات شاشة الكاشير (شغّالة وإنت واقف في خانة الباركود). */
export const POS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "الرجوع لخانة الباركود والبحث",
    match: plainKey("F2"),
  },
  heldList: {
    label: "F3",
    description: "الفواتير المعلّقة",
    match: plainKey("F3"),
  },
  holdInvoice: {
    label: "F4",
    description: "تعليق الفاتورة الحالية",
    match: plainKey("F4"),
  },
  customer: {
    label: "F6",
    description: "اختيار العميل",
    match: plainKey("F6"),
  },
  cancelInvoice: {
    label: "F7",
    description: "إلغاء الفاتورة",
    match: plainKey("F7"),
  },
  discount: {
    label: "F8",
    description: "خصم على الفاتورة",
    match: plainKey("F8"),
  },
  pay: {
    label: "F9",
    description: "الدفع",
    match: plainKey("F9"),
  },
  help: {
    label: "Ctrl+/",
    description: "قائمة الاختصارات",
    match: (event: KeyboardEvent) =>
      (event.ctrlKey || event.metaKey) && event.code === "Slash",
  },
} as const satisfies Record<string, PosShortcut>;

export interface PosKeyHint {
  keys: string;
  description: string;
}

/** مفاتيح بتشتغل جوه خانة الباركود (مش اختصارات عامة). */
export const POS_SEARCH_KEYS: PosKeyHint[] = [
  {
    keys: "Enter",
    description: "إضافة الصنف (باركود مطابق أو النتيجة المظللة)",
  },
  { keys: "Enter (خانة فاضية)", description: "فتح الدفع" },
  {
    keys: "↑ ↓",
    description: "التنقل بين النتائج، أو بين أصناف الفاتورة لو الخانة فاضية",
  },
  {
    keys: "+ / -",
    description: "زيادة أو تقليل كمية الصنف المحدد (الخانة فاضية)",
  },
  { keys: "Delete", description: "حذف الصنف المحدد (فيه تراجع)" },
  { keys: "3*باركود", description: "إضافة 3 قطع مرة واحدة" },
  { keys: "5* ثم Enter", description: "ضبط كمية الصنف المحدد على 5" },
  { keys: "Esc", description: "مسح الخانة" },
];

export const POS_PAYMENT_KEYS: PosKeyHint[] = [
  { keys: "F1 / F2 / F3", description: "كاش / آجل / مختلط" },
  { keys: "F6", description: "اختيار العميل" },
  { keys: "Enter", description: "تأكيد الدفع" },
  { keys: "Esc", description: "رجوع للفاتورة" },
];
