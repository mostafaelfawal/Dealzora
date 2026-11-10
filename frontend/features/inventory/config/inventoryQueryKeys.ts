import type { InventoryTab } from "../types/inventory";

export const inventoryKeys = {
  all: ["inventory"] as const,
  report: (days: number) => ["inventory", "report", days] as const,
  ledger: (id: string, page: number) =>
    ["inventory", "ledger", id, page] as const,
  /** تحت "products" حتى يُحدَّث مع أي تعديل على الأصناف. */
  products: (tab: InventoryTab, q: string, page: number, pageSize: number) =>
    ["products", "inventory", tab, q, page, pageSize] as const,
};

/** ما يتأثر بأي تعديل يدوي على المخزون. */
export const INVENTORY_AFFECTED_KEYS = [
  inventoryKeys.all,
  ["products"],
  ["reports"],
  ["dashboard"],
  ["pos", "catalog"],
] as const;
