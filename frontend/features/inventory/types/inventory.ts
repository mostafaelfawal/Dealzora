export type MovementType =
  | "opening"
  | "purchase"
  | "purchase_return"
  | "sale"
  | "sale_return"
  | "count"
  | "damage"
  | "gift"
  | "adjustment";

export type AdjustReason = "count" | "damage" | "gift" | "other";

export type InventoryTab = "all" | "low" | "out" | "stagnant";

export interface LedgerEntry {
  id: string;
  type: MovementType;
  /** موجب = دخل، سالب = خرج. */
  qtyDelta: number;
  balanceAfter: number;
  unitCost: number | null;
  note: string;
  refType: string | null;
  createdAt: number;
}

export interface StockRow {
  productId: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  costPrice: number;
  stockValue: number;
  lastSoldAt: number | null;
}

export interface StockReport {
  stockValue: number;
  low: StockRow[];
  out: StockRow[];
  stagnant: StockRow[];
  stagnantValue: number;
}

export interface AdjustInput {
  reason: AdjustReason;
  /** جرد: الرصيد الفعلي. تالف/هدية: الكمية الخارجة. أخرى: فرق موقّع. */
  qty: number;
  note: string;
}

/** الصنف الذي يُفتح له نافذة التعديل أو سجل الحركة. */
export interface AdjustTarget {
  productId: string;
  name: string;
  unit: string;
  stock: number;
}
