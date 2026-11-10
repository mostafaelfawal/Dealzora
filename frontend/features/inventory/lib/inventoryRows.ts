import type { Product } from "@/features/products/types/product";

import type { AdjustTarget, StockRow } from "../types/inventory";

/** صنف من قائمة المنتجات ← صف مخزون. القيمة بسعر الشراء، والرصيد السالب لا يُحسب. */
export const stockRowFromProduct = (p: Product): StockRow => ({
  productId: p.id,
  name: p.name,
  unit: p.unit,
  stock: p.stock,
  minStock: p.minStock,
  costPrice: p.costPrice ?? 0,
  stockValue: Math.max(p.stock, 0) * (p.costPrice ?? 0),
  lastSoldAt: null,
});

export const toAdjustTarget = (r: StockRow): AdjustTarget => ({
  productId: r.productId,
  name: r.name,
  unit: r.unit,
  stock: r.stock,
});

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(row: Pick<StockRow, "stock" | "minStock">) {
  if (row.stock <= 0) return "out";
  if (row.minStock > 0 && row.stock <= row.minStock) return "low";
  return "ok";
}
