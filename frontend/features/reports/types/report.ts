export type ProductRank = "top" | "bottom" | "profit" | "revenue";
export type ReportTab = "sales" | "products" | "stock" | "debts" | "treasury";
export type SalesMetric = "net" | "profit" | "count";

export interface SalesDay {
  day: number;
  count: number;
  revenue: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
}

export interface SalesReport {
  days: SalesDay[];
  count: number;
  revenue: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
  discounts: number;
  cash: number;
  credit: number;
  expenses: number;
  netProfit: number;
}

export interface ProductRow {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  stock: number;
}

export interface DebtsReport {
  customersTotal: number;
  overdueTotal: number;
  overdueCount: number;
  customers: {
    id: string;
    name: string;
    phone: string | null;
    balance: number;
    creditLimit: number;
    lastPaymentAt: number | null;
    isOverdue: boolean;
  }[];
  suppliersTotal: number;
  suppliers: {
    id: string;
    name: string;
    phone: string | null;
    balance: number;
  }[];
}

export interface TreasuryReport {
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  byKind: {
    kind: string;
    direction: "in" | "out";
    count: number;
    total: number;
  }[];
}
