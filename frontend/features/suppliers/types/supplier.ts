export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  /** بالجنيه. موجب = مستحق للمورد علينا، سالب = دفعة مقدّمة له. */
  balance: number;
  isActive: boolean;
  /** نسخة السجل للتحكم في التعارض (base_version). */
  version: number;
  createdAt: string;
}

/** "owed" = عليه مستحقات، "settled" = لا مستحقات. */
export type BalanceFilter = "all" | "owed" | "settled";

/** نفس قيم الـ backend بالضبط. */
export type SupplierSortKey =
  "name_asc" | "newest" | "balance_desc" | "balance_asc";

export type SuppliersView = "cards" | "table";

export interface SupplierFilters {
  query: string;
  balance: BalanceFilter;
  sort: SupplierSortKey;
  page: number;
  pageSize: number;
}

export interface SuppliersPage {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SuppliersSummary {
  total: number;
  owed: number;
  inactive: number;
  /** إجمالي المستحقات للموردين بالجنيه. */
  totalPayable: number;
}

export type SupplierTransactionType =
  "opening" | "purchase" | "purchase_return" | "payment" | "adjustment";

export interface SupplierTransaction {
  id: string;
  type: SupplierTransactionType;
  /** موجب = زاد المستحق للمورد، سالب = نقص (سداد أو مرتجع). */
  amount: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
}

export interface SupplierStatementPage {
  items: SupplierTransaction[];
  total: number;
  page: number;
  pageSize: number;
}
