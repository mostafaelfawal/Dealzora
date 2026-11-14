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
  /** كل الدفع الإلكتروني (محافظ/بطاقات/تحويلات). */
  walletSales: number;
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

/** العروض التلقائية: الحالة الآن وأثرها في الفترة. */
export interface PromotionsBrief {
  active: number;
  scheduled: number;
  discount: number;
  prevDiscount: number;
  invoices: number;
  /** value = الخصم، extra = عدد السطور. */
  top: NamedValue[];
}

export interface LoyaltyBrief {
  enabled: boolean;
  earned: number;
  redeemed: number;
  redeemValue: number;
  outstandingPoints: number;
  outstandingValue: number;
  members: number;
}

export interface CustomersBrief {
  newCustomers: number;
  activeCustomers: number;
  /** value = صافي المشتريات، extra = عدد الفواتير. */
  top: NamedValue[];
}

export interface PurchasingBrief {
  purchasesTotal: number;
  prevPurchasesTotal: number;
  purchasesCount: number;
  draftOrders: number;
  sentOrders: number;
  openOrdersTotal: number;
  receivedMonth: number;
}

export interface ExpiryBrief {
  trackedProducts: number;
  expiredBatches: number;
  expiredValue: number;
  soon7: number;
  soon30: number;
  soon30Value: number;
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
    paymentLabel: string;
    total: number;
  }[];
  /** key = السبب، value = القيمة، extra = العدد. */
  returnReasons: NamedValue[];
  promotions: PromotionsBrief;
  /** null = الميزة ليست في خطة المحل. */
  loyalty: LoyaltyBrief | null;
  customers: CustomersBrief | null;
  purchasing: PurchasingBrief | null;
  expiry: ExpiryBrief | null;
}

export type TrendMetric = "net" | "profit" | "invoices";
