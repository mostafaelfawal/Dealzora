import type {
  BalanceFilter,
  SupplierSortKey,
  SupplierTransactionType,
} from "../types/supplier";

export const PAGE_SIZES = [12, 24, 48, 96];

export const SORT_OPTIONS: { value: SupplierSortKey; label: string }[] = [
  { value: "name_asc", label: "الاسم (أ - ي)" },
  { value: "newest", label: "الأحدث" },
  { value: "balance_desc", label: "المستحق الأعلى" },
  { value: "balance_asc", label: "المستحق الأقل" },
];

export const BALANCE_FILTERS: { value: BalanceFilter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "owed", label: "عليهم مستحقات" },
  { value: "settled", label: "مسدّدون" },
];

export const TRANSACTION_LABELS: Record<SupplierTransactionType, string> = {
  opening: "رصيد افتتاحي",
  purchase: "فاتورة شراء",
  purchase_return: "مرتجع مشتريات",
  payment: "دفعة سداد",
  adjustment: "تسوية",
};

export const SUPPLIERS_SEARCH_ID = "suppliers-search";
