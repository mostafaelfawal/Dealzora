import { plain, type Shortcut } from "@/lib/shortcuts";

import { getPaymentConfig } from "@/lib/payments";

import type {
  BuiltinMethod,
  PaymentMethod,
  ReturnReason,
  SaleSort,
  SaleStatusFilter,
} from "../types/sale";

export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 24;
export const SALES_SEARCH_DEBOUNCE_MS = 300;

export const BUILTIN_LABEL: Record<BuiltinMethod, string> = {
  cash: "نقدي",
  credit: "آجل",
  mixed: "مختلط",
};

/** أسماء طرق قديمة لفواتير بلا لقطة اسم (نفس LEGACY_LABELS في الـ backend). */
const LEGACY_LABEL: Record<string, string> = {
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
};

/** الدفع الإلكتروني: أي طريقة غير المدمجة. المبلغ كامل في حساب المحل، لا في الدرج. */
export const isWalletMethod = (m: PaymentMethod) => !(m in BUILTIN_LABEL);

/** اسم الطريقة للعرض حين لا يرسله السيرفر: المدمجة ← الإعدادات ← الأسماء القديمة ← المعرّف. */
export const paymentLabel = (m: PaymentMethod): string =>
  BUILTIN_LABEL[m as BuiltinMethod] ??
  getPaymentConfig().methods.find((x) => x.id === m)?.name ??
  LEGACY_LABEL[m] ??
  m;

/** فلتر طريقة الدفع في سجل الفواتير: المدمجة + كل طرق المحل الإلكترونية. */
export const methodOptions = (
  methods: { id: string; name: string }[],
): { value: PaymentMethod | "all"; label: string }[] => [
  { value: "all", label: "كل طرق الدفع" },
  ...(Object.keys(BUILTIN_LABEL) as BuiltinMethod[]).map((k) => ({
    value: k,
    label: BUILTIN_LABEL[k],
  })),
  ...methods.map((m) => ({ value: m.id, label: m.name })),
];

export const STATUS_TABS: { id: SaleStatusFilter; label: string }[] = [
  { id: "all", label: "كل الفواتير" },
  { id: "credit", label: "فيها آجل" },
  { id: "wallet", label: "دفع إلكتروني" },
  { id: "returned", label: "عليها مرتجع" },
];

export const SORT_OPTIONS: { value: SaleSort; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
  { value: "total_desc", label: "الأعلى قيمة" },
  { value: "total_asc", label: "الأقل قيمة" },
];

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  wrong_item: "صنف خاطئ",
  defective: "تالف / معيب",
  customer_changed: "غيّر رأيه",
  other: "أخرى",
};

export const RETURN_REASONS = Object.entries(RETURN_REASON_LABEL).map(
  ([id, label]) => ({ id: id as ReturnReason, label }),
);

export const SALE_SHORTCUTS = {
  print: {
    label: "Ctrl P",
    description: "طباعة الفاتورة المفتوحة",
    match: (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.code === "KeyP",
  },
  whatsapp: {
    label: "F7",
    description: "إرسال الفاتورة واتساب",
    match: plain("F7"),
  },
  returnSale: {
    label: "F10",
    description: "مرتجع من الفاتورة",
    match: plain("F10"),
  },
} satisfies Record<string, Shortcut>;

/** فلتر السبب في سجل المرتجعات. */
export const RETURN_REASON_FILTER_OPTIONS: {
  value: ReturnReason | "all";
  label: string;
}[] = [
  { value: "all", label: "كل الأسباب" },
  ...RETURN_REASONS.map((r) => ({ value: r.id, label: r.label })),
];
