export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  /** المديونية الحالية (موجب = عليه دين). */
  balance: number;
  /** الحد الائتماني. 0 = بيع نقدي فقط. */
  creditLimit: number;
  isActive: boolean;
  /** عميل جملة: يأخذ سعر الجملة على كل صنف له سعر جملة. */
  isWholesale: boolean;
  /** رصيد نقاط الولاء. */
  loyaltyPoints: number;
  totalSales: number;
  lastPurchaseAt: number | null;
  lastPaymentAt: number | null;
  createdAt: number;
  version: number;
}

/** ما يرسله الفورم للـ backend. */
export interface CustomerInput {
  name: string;
  phone: string;
  address: string;
  notes: string;
  creditLimit: number;
  /** رصيد افتتاحي (دين سابق) عند الإضافة فقط. */
  openingBalance: number;
  isActive: boolean;
  isWholesale: boolean;
}

export interface PaymentInput {
  amount: number;
  note: string;
}

export type CustomerFilter =
  "all" | "debtors" | "overdue" | "limit" | "inactive";
export type CustomerSortKey = "debt" | "name" | "recent" | "sales" | "newest";
export type CustomersView = "cards" | "table";
export type CreditLevel = "cash" | "ok" | "warn" | "full";

export interface CustomerFilters {
  query: string;
  filter: CustomerFilter;
  sort: CustomerSortKey;
  page: number;
  pageSize: number;
}

export interface CustomersSummary {
  total: number;
  totalDebt: number;
  debtors: number;
  overdue: number;
  atLimit: number;
  inactive: number;
}

export type StatementEntryType =
  "sale" | "payment" | "return" | "opening" | "adjustment";

export interface StatementEntry {
  id: string;
  date: number;
  type: StatementEntryType;
  ref: string;
  /** يزيد الدين (بيع / رصيد افتتاحي). */
  debit: number;
  /** ينقص الدين (دفعة / مرتجع). */
  credit: number;
  /** الرصيد بعد الحركة. */
  balance: number;
}
