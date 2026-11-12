export type BuiltinMethod = "cash" | "credit" | "mixed";
/** المدمجة أو معرّف طريقة إلكترونية من الإعدادات (vodafone_cash، stc_pay...). */
export type PaymentMethod = BuiltinMethod | (string & {});

/** رد مرتجع فاتورة مدفوعة إلكترونياً: لنفس المحفظة أو كاش من الدرج. */
export type RefundVia = "wallet" | "cash";
export type ReturnReason =
  "wrong_item" | "defective" | "customer_changed" | "other";
export type SaleStatusFilter = "all" | "credit" | "wallet" | "returned";
export type SaleSort = "newest" | "oldest" | "total_desc" | "total_asc";

/** المال بالجنيه والكميات عادية (الـ mapper يحوّل من قروش و× 1000). */
export interface SaleLine {
  id: string;
  productId: string;
  /** null = الوحدة الأساسية. */
  unitId: string | null;
  name: string;
  unitName: string;
  /** عدد الوحدات الأساسية في وحدة البيع (الكرتونة 12 = 12). */
  factor: number;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  /** بعد توزيع خصم الفاتورة (= ما دُفع فعلاً في السطر). */
  netTotal: number;
  returnedQty: number;
  /** null للكاشير. */
  unitCost: number | null;
}

export interface Sale {
  id: string;
  number: number;
  soldAt: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  cashierName: string | null;
  paymentMethod: PaymentMethod;
  /** اسم الطريقة للعرض (لقطة وقت البيع للإلكتروني). */
  paymentLabel: string;
  subtotal: number;
  linesDiscount: number;
  invoiceDiscount: number;
  total: number;
  cashAmount: number;
  creditAmount: number;
  /** المدفوع إلكترونياً (لا يدخل الدرج). */
  walletAmount: number;
  /** رقم العملية أو رقم المحوِّل (اختياري). */
  paymentRef: string | null;
  received: number;
  change: number;
  returnedTotal: number;
  costTotal: number | null;
  profit: number | null;
  note: string;
  lines: SaleLine[];
}

export interface SaleReturnLine {
  id: string;
  saleLineId: string;
  productId: string;
  name: string;
  unitName: string;
  qty: number;
  amount: number;
}

export interface SaleReturn {
  id: string;
  number: number;
  saleId: string;
  saleNumber: number;
  returnedAt: number;
  reason: ReturnReason;
  note: string;
  customerName: string | null;
  cashierName: string | null;
  total: number;
  cashRefund: number;
  creditRefund: number;
  walletRefund: number;
  lines: SaleReturnLine[];
}

export interface SalesSummary {
  todayCount: number;
  todayTotal: number;
  todayProfit: number;
  todayReturns: number;
  weekTotal: number;
  monthTotal: number;
  monthProfit: number;
}

export interface SaleFilters {
  q?: string;
  customerId?: string;
  method?: PaymentMethod | "all";
  status?: SaleStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  sort?: SaleSort;
  page: number;
  pageSize: number;
}

/* ---------- إنشاء فاتورة / مرتجع (ما يرسله الكاشير) ---------- */

export interface SaleLineInput {
  productId: string;
  /** null/غائب = الوحدة الأساسية. */
  unitId?: string | null;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface SaleInput {
  clientRef: string;
  customerId: string | null;
  lines: SaleLineInput[];
  invoiceDiscount: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  received: number;
  paymentRef?: string;
  note?: string;
}

export interface ReturnInput {
  reason: ReturnReason;
  note?: string;
  lines: { saleLineId: string; qty: number }[];
  /** للفواتير المدفوعة إلكترونياً فقط (الافتراضي: لنفس المحفظة). */
  refundVia?: RefundVia;
}
