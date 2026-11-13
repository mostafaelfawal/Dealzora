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

/**
 * Ctrl/⌘ + حرف، مع مطابقة `event.code` (وليس `event.key`)
 * لتعمل الاختصارات حتى مع لوحة المفاتيح العربية.
 */
const ctrlCode = (code: string, shift: boolean) => (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  event.shiftKey === shift &&
  event.code === code;

/** اختصارات شاشة الكاشير (تعمل وأنت في خانة الباركود). */
export const POS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "الرجوع إلى خانة الباركود والبحث",
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
  lineDiscount: {
    label: "F5",
    description: "خصم على الصنف المحدد",
    match: plainKey("F5"),
  },
  pay: {
    label: "F9",
    description: "الدفع",
    match: plainKey("F9"),
  },
  returns: {
    label: "F10",
    description: "مرتجع أو استبدال",
    match: plainKey("F10"),
  },
  undo: {
    label: "Ctrl+Z",
    description: "التراجع عن آخر تعديل في الفاتورة",
    match: ctrlCode("KeyZ", false),
  },
  redo: {
    label: "Ctrl+Y",
    description: "إعادة التعديل الذي تم التراجع عنه",
    match: (event: KeyboardEvent) =>
      ctrlCode("KeyZ", true)(event) || ctrlCode("KeyY", false)(event),
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

/** مفاتيح تعمل داخل خانة الباركود (وليست اختصارات عامة). */
export const POS_SEARCH_KEYS: PosKeyHint[] = [
  {
    keys: "Enter",
    description: "إضافة الصنف (باركود مطابق أو النتيجة المظللة)",
  },
  { keys: "Enter (خانة فارغة)", description: "فتح الدفع" },
  {
    keys: "↑ ↓",
    description:
      "التنقل بين النتائج، أو بين أصناف الفاتورة إذا كانت الخانة فارغة",
  },
  {
    keys: "+ / -",
    description: "زيادة أو تقليل كمية الصنف المحدد (والخانة فارغة)",
  },
  { keys: "Delete", description: "حذف الصنف المحدد (مع إمكانية التراجع)" },
  { keys: "3*باركود", description: "إضافة 3 قطع دفعة واحدة" },
  { keys: "5* ثم Enter", description: "ضبط كمية الصنف المحدد على 5" },
  { keys: "Esc", description: "مسح الخانة" },
];

export const POS_PAYMENT_KEYS: PosKeyHint[] = [
  { keys: "F1 / F2 / F3", description: "نقدي / آجل / مختلط" },
  { keys: "F6", description: "اختيار العميل" },
  { keys: "Enter", description: "تأكيد الدفع" },
  { keys: "Esc", description: "رجوع إلى الفاتورة" },
];
