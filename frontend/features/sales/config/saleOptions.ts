import { plain, type Shortcut } from "@/lib/shortcuts";

import type {
  PaymentMethod,
  ReturnReason,
  SaleSort,
  SaleStatusFilter,
} from "../types/sale";

export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 24;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "كاش",
  credit: "آجل",
  mixed: "مختلط",
};

export const METHOD_OPTIONS: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "كل طرق الدفع" },
  { value: "cash", label: "كاش" },
  { value: "credit", label: "آجل" },
  { value: "mixed", label: "مختلط" },
];

export const STATUS_TABS: { id: SaleStatusFilter; label: string }[] = [
  { id: "all", label: "كل الفواتير" },
  { id: "credit", label: "فيها آجل" },
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

export const saleKeys = {
  all: ["sales"] as const,
  list: (f: object) => [...saleKeys.all, "list", f] as const,
  detail: (id: string) => [...saleKeys.all, "detail", id] as const,
  summary: () => [...saleKeys.all, "summary"] as const,
  returns: (f: object) => [...saleKeys.all, "returns", f] as const,
};

export const SALE_SHORTCUTS = {
  print: { label: "Ctrl P", description: "طباعة الفاتورة المفتوحة", match: (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.code === "KeyP" },
  whatsapp: { label: "F7", description: "إرسال الفاتورة واتساب", match: plain("F7") },
  returnSale: { label: "F10", description: "مرتجع من الفاتورة", match: plain("F10") },
} satisfies Record<string, Shortcut>;
