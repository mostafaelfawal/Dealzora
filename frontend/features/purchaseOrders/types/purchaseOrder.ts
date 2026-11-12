export type Urgency = "out" | "critical" | "low" | "soon";
export type OrderStatus = "draft" | "sent" | "received" | "cancelled";
export type OrderStatusFilter = "open" | "all" | OrderStatus;

/** إعدادات حساب الاقتراح (تُحفظ على هذا الجهاز). */
export interface ReorderSettings {
  salesDays: number;
  coverDays: number;
  leadDays: number;
  roundPacks: boolean;
}

export interface Suggestion {
  productId: string;
  name: string;
  barcode: string;
  categoryName: string | null;
  unit: string;
  allowDecimal: boolean;
  stock: number;
  minStock: number;
  onOrder: number;
  soldQty: number;
  avgDaily: number;
  /** null = لا مبيعات في الفترة. */
  daysLeft: number | null;
  urgency: Urgency;
  suggestedQty: number;
  packName: string | null;
  /** عدد الوحدات الأساسية في الكرتونة/الدستة. */
  packSize: number | null;
  unitCost: number;
  lineTotal: number;
  supplierId: string | null;
  supplierName: string | null;
  lastPurchasedOn: string | null;
}

export interface SuggestionsResult {
  items: Suggestion[];
  totals: {
    count: number;
    out: number;
    critical: number;
    low: number;
    soon: number;
    estimatedTotal: number;
    suppliers: number;
  };
}

export interface OrderLine {
  id: string;
  productId: string;
  name: string;
  unitName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
  stockAtOrder: number;
  /** null = الصنف حُذف. */
  currentStock: number | null;
}

export interface PurchaseOrder {
  id: string;
  number: number;
  version: number;
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  status: OrderStatus;
  total: number;
  note: string;
  createdAt: number;
  createdByName: string | null;
  sentAt: number | null;
  closedAt: number | null;
  purchaseId: string | null;
  purchaseNumber: number | null;
  lines: OrderLine[];
}

export interface OrdersSummary {
  draft: number;
  sent: number;
  openTotal: number;
  receivedMonth: number;
}

export interface OrderInput {
  supplierId: string;
  note: string;
  lines: { productId: string; qty: number; unitCost: number }[];
}

/** سطر قابل للتعديل في شاشة الاقتراح (قيم نصية كما يكتبها المستخدم). */
export interface SuggestionDraft {
  selected: boolean;
  qty: string;
  /** المورد المختار لهذا الصنف ("" = بدون مورد). */
  supplierId: string;
}
