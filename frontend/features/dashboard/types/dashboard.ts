import type { PaymentMethod } from "@/features/sales/types/sale";

/** كل المبالغ بالجنيه والكميات عادية (الـ mapper يحوّل). */
export interface Kpis {
  netSales: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  invoices: number;
  avgTicket: number;
  itemsSold: number;
  returns: number;
  discounts: number;
  cashSales: number;
  creditSales: number;
}

export interface TrendDay {
  day: number;
  net: number;
  profit: number;
  invoices: number;
  prevNet: number;
  prevProfit: number;
}

export interface NamedValue {
  key: string;
  label: string;
  value: number;
  extra: number;
}

export interface Cashier {
  userId: string;
  name: string;
  invoices: number;
  net: number;
  returns: number;
  avgTicket: number;
  discounts: number;
}

export interface Health {
  stockValue: number;
  lowStock: number;
  outOfStock: number;
  stagnantCount: number;
  stagnantValue: number;
  customersDebt: number;
  overdueCustomers: number;
  overdueDebt: number;
  suppliersPayable: number;
  treasuryBalance: number;
}

export interface Overview {
  dateFrom: string;
  dateTo: string;
  prevFrom: string;
  prevTo: string;
  kpis: Kpis;
  prev: Kpis;
  trend: TrendDay[];
  heatmap: { weekday: number; hour: number; invoices: number; net: number }[];
  payments: NamedValue[];
  topProducts: NamedValue[];
  categories: NamedValue[];
  expensesByCategory: NamedValue[];
  cashFlow: { day: number; cashIn: number; cashOut: number }[];
  cashiers: Cashier[];
  health: Health;
  shift: {
    cashierName: string | null;
    openedAt: number;
    salesCount: number;
    expectedCash: number;
  } | null;
  recentSales: {
    id: string;
    number: number;
    soldAt: number;
    customerName: string | null;
    paymentMethod: PaymentMethod;
    total: number;
  }[];
}

export type TrendMetric = "net" | "profit" | "invoices";
