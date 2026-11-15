export type ProductRank = "top" | "bottom" | "profit" | "revenue";
export type ReportTab =
  | "sales"
  | "products"
  | "purchases"
  | "promotions"
  | "returns"
  | "customers"
  | "cashiers"
  | "stock"
  | "debts"
  | "treasury"
  | "branches";
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
  /** تفصيل الخصومات (discounts = الثلاثة الأولى، والنقاط منفصلة). */
  promoDiscount: number;
  linesDiscount: number;
  invoiceDiscount: number;
  loyaltyDiscount: number;
  /** ضريبة القيمة المضافة: المحصّلة، والمردودة بالمرتجعات، والصافي المستحق. */
  taxTotal: number;
  taxReturns: number;
  taxNet: number;
  /** فواتير قبل إضافة الضريبة في الفترة (غير داخلة في المجموع). */
  untaxedCount: number;
  cash: number;
  credit: number;
  /** كل الدفع الإلكتروني. */
  wallet: number;
  /** تفصيله حسب الطريقة (المفعّلة في الإعدادات حتى لو صفر، ثم أي طريقة استُخدمت). */
  electronic: { key: string; label: string; value: number }[];
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

/* ---------- الأقسام ---------- */
export interface CategorySales {
  /** "none" = بدون قسم. */
  id: string;
  name: string;
  revenue: number;
  profit: number;
  qty: number;
  products: number;
}

export interface ProductsReport {
  items: ProductRow[];
  categories: CategorySales[];
}

/* ---------- المشتريات ---------- */
export interface PurchasedProduct {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  total: number;
  firstCost: number;
  lastCost: number;
  changePct: number;
}

export interface PurchasesReport {
  total: number;
  count: number;
  paid: number;
  credit: number;
  discount: number;
  returned: number;
  net: number;
  bySupplier: {
    id: string;
    name: string;
    total: number;
    count: number;
    returned: number;
  }[];
  topProducts: PurchasedProduct[];
  priceChanges: PurchasedProduct[];
  draftOrders: number;
  sentOrders: number;
  openOrdersTotal: number;
  receivedOrders: number;
  lateOrders: {
    id: string;
    number: number;
    supplierName: string;
    total: number;
    sentAt: number;
    days: number;
  }[];
}

/* ---------- العروض ---------- */
export type PromoStatus = "active" | "scheduled" | "expired" | "paused";

export interface PromoRow {
  /** null = عرض حُذف لكنه طُبق في الفترة. */
  id: string | null;
  name: string;
  kind: "percent" | "amount" | "buy_get" | null;
  status: PromoStatus | null;
  startsOn: string | null;
  endsOn: string | null;
  discount: number;
  lines: number;
  invoices: number;
  qty: number;
  revenue: number;
}

export interface PromotionsReport {
  discount: number;
  invoices: number;
  salesCount: number;
  manualDiscount: number;
  promos: PromoRow[];
}

/* ---------- المرتجعات ---------- */
export interface ReturnsReport {
  count: number;
  total: number;
  cashRefund: number;
  creditRefund: number;
  walletRefund: number;
  revenue: number;
  /** key = السبب، value = القيمة، extra = العدد. */
  byReason: { key: string; value: number; count: number }[];
  topProducts: {
    productId: string;
    name: string;
    unit: string;
    qty: number;
    amount: number;
    times: number;
  }[];
  byCashier: { userId: string; name: string; count: number; total: number }[];
}

/* ---------- العملاء ونقاط الولاء ---------- */
export interface CustomersReport {
  totalCustomers: number;
  active: number;
  new: number;
  walkInSales: number;
  customerSales: number;
  top: {
    id: string;
    name: string;
    phone: string | null;
    net: number;
    invoices: number;
    avgTicket: number;
    lastAt: number | null;
    points: number;
  }[];
  lapsed: {
    id: string;
    name: string;
    phone: string | null;
    lastAt: number;
    days: number;
    lifetime: number;
  }[];
  loyalty: {
    enabled: boolean;
    earned: number;
    redeemed: number;
    redeemValue: number;
    adjusted: number;
    outstandingPoints: number;
    outstandingValue: number;
    members: number;
    topBalances: { id: string; name: string; points: number; value: number }[];
  };
}

/* ---------- الكاشيرية والورديات ---------- */
export interface CashierRow {
  userId: string;
  name: string;
  invoices: number;
  sales: number;
  returns: number;
  returnsCount: number;
  net: number;
  avgTicket: number;
  manualDiscount: number;
  promoDiscount: number;
  shifts: number;
  shortage: number;
  overage: number;
  worstDiff: number;
}

export interface CashiersReport {
  cashiers: CashierRow[];
  shiftsCount: number;
  openShifts: number;
  shortage: number;
  overage: number;
  differences: {
    id: string;
    cashierName: string;
    openedAt: number;
    closedAt: number | null;
    expected: number;
    counted: number;
    difference: number;
  }[];
}
