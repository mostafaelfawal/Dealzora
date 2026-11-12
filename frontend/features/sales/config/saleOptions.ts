import { plain, type Shortcut } from "@/lib/shortcuts";

import type {
  PaymentMethod,
  ReturnReason,
  SaleSort,
  SaleStatusFilter,
} from "../types/sale";

export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 24;
export const SALES_SEARCH_DEBOUNCE_MS = 300;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "كاش",
  credit: "آجل",
  mixed: "مختلط",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
};

/** الدفع الإلكتروني: المبلغ كامل في محفظة المحل، لا في الدرج. */
export const WALLET_METHODS = ["vodafone_cash", "instapay"] as const;
export type WalletMethod = (typeof WALLET_METHODS)[number];
export const isWalletMethod = (m: PaymentMethod): m is WalletMethod =>
  (WALLET_METHODS as readonly PaymentMethod[]).includes(m);

export const METHOD_OPTIONS: { value: PaymentMethod | "all"; label: string }[] =
  [
    { value: "all", label: "كل طرق الدفع" },
    { value: "cash", label: "كاش" },
    { value: "credit", label: "آجل" },
    { value: "mixed", label: "مختلط" },
    { value: "vodafone_cash", label: "فودافون كاش" },
    { value: "instapay", label: "إنستاباي" },
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
