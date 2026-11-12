export type RefundMethod = "balance" | "cash";
export type PurchaseStatusFilter = "all" | "credit" | "returned";

export interface PurchaseLine {
  id: string;
  productId: string;
  name: string;
  unitName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
  returnedQty: number;
}

export interface Purchase {
  id: string;
  number: number;
  supplierId: string;
  supplierName: string;
  supplierInvoice: string;
  /** YYYY-MM-DD */
  purchasedOn: string;
  createdAt: number;
  createdByName: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  returnedTotal: number;
  note: string;
  lines: PurchaseLine[];
}

export interface PurchasesSummary {
  monthCount: number;
  monthTotal: number;
  monthPaid: number;
  returnsMonth: number;
}

export interface PurchaseFilters {
  q: string;
  supplierId?: string;
  status: PurchaseStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

/** سطر في فورم فاتورة الشراء (قيم نصية كما يكتبها المستخدم). */
export interface PurchaseDraftLine {
  key: string;
  productId: string;
  name: string;
  unit: string;
  allowDecimal: boolean;
  currentCost: number;
  currentPrice: number;
  qty: string;
  cost: string;
  /** فارغ = لا تغيير في سعر البيع. */
  salePrice: string;
  /** صنف متتبَّع: رقم التشغيلة وتاريخ الصلاحية (YYYY-MM-DD) للدفعة الداخلة. */
  trackExpiry?: boolean;
  batchNo?: string;
  expiryDate?: string;
}

export interface PurchaseInput {
  supplierId: string;
  supplierInvoice: string;
  purchasedOn: string;
  lines: {
    productId: string;
    qty: number;
    unitCost: number;
    newSalePrice: number | null;
    batchNo?: string | null;
    expiryDate?: string | null;
  }[];
  discount: number;
  paidAmount: number;
  note: string;
  /** فاتورة ناتجة عن طلب شراء: يُغلق الطلب «تم الاستلام». */
  orderId?: string | null;
}
