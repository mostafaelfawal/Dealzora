import {
  getStockLevel,
  normalizeSearch,
  round2,
} from "@/features/pos/lib/posCalc";
import { PRODUCT_CATEGORIES } from "../mocks/productsData";
import type { Product, ProductFilters } from "../types/product";
import { calcMargin } from "./productCalc";

export const DEFAULT_FILTERS: ProductFilters = {
  query: "",
  category: "all",
  stock: "all",
  sort: "name",
};

export const isFiltered = (f: ProductFilters) =>
  f.query.trim() !== "" || f.category !== "all" || f.stock !== "all";

export function getCategoryLabel(id: string): string {
  return PRODUCT_CATEGORIES.find((c) => c.id === id)?.label ?? "بدون قسم";
}

export function applyFilters(
  products: Product[],
  filters: ProductFilters,
): Product[] {
  const query = normalizeSearch(filters.query);
  const tokens = query ? query.split(/\s+/) : [];

  const filtered = products.filter((p) => {
    if (filters.category !== "all" && p.category !== filters.category)
      return false;
    if (filters.stock !== "all" && getStockLevel(p) !== filters.stock)
      return false;
    if (tokens.length === 0) return true;
    const name = normalizeSearch(p.name);
    return (
      p.barcode.includes(query) || tokens.every((token) => name.includes(token))
    );
  });

  const marginOf = (p: Product) =>
    calcMargin(p.costPrice, p.salePrice)?.percent ?? -Infinity;

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "price":
        return b.salePrice - a.salePrice;
      case "stock":
        return a.stock - b.stock;
      case "margin":
        return marginOf(b) - marginOf(a);
      default:
        return a.name.localeCompare(b.name, "ar");
    }
  });
}

export interface ProductsSummary {
  total: number;
  /** قيمة المخزون بسعر الشراء. */
  stockValue: number;
  low: number;
  out: number;
}

export function summarize(products: Product[]): ProductsSummary {
  let stockValue = 0;
  let low = 0;
  let out = 0;
  for (const p of products) {
    stockValue += p.costPrice * Math.max(p.stock, 0);
    const level = getStockLevel(p);
    if (level === "low") low++;
    if (level === "out") out++;
  }
  return { total: products.length, stockValue: round2(stockValue), low, out };
}
