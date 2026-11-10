import type { PurchaseFilters } from "../types/purchase";

export const purchaseKeys = {
  all: ["purchases"] as const,
  list: (f: PurchaseFilters) => [...purchaseKeys.all, "list", f] as const,
  detail: (id: string) => [...purchaseKeys.all, "detail", id] as const,
  summary: () => [...purchaseKeys.all, "summary"] as const,
  products: () => [...purchaseKeys.all, "products"] as const,
  suppliers: () => [...purchaseKeys.all, "suppliers"] as const,
};

/** كل ما يتأثر بفاتورة شراء أو مرتجعها: المخزون، الموردون، الخزنة، والتقارير. */
export const PURCHASE_AFFECTED_KEYS = [
  purchaseKeys.all,
  ["products"],
  ["suppliers"],
  ["treasury"],
  ["reports"],
  ["dashboard"],
  ["pos", "catalog"],
] as const;
