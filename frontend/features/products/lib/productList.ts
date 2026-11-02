import type { GetProductsParams } from "../api/products.api";
import type { ProductFilters, ProductsSummary } from "../types/product";

export const DEFAULT_FILTERS: ProductFilters = {
  query: "",
  category: "all",
  stock: "all",
  sort: "name_asc",
  page: 1,
  pageSize: 24,
};

export const EMPTY_SUMMARY: ProductsSummary = {
  total: 0,
  low: 0,
  out: 0,
  stockValue: 0,
};

export const isFiltered = (f: ProductFilters) =>
  f.query.trim() !== "" || f.category !== "all" || f.stock !== "all";

/** يحوّل حالة الفلاتر إلى query params. القيم الافتراضية لا تُرسل. */
export function toListParams(f: ProductFilters): GetProductsParams {
  return {
    q: f.query.trim() || undefined,
    category_id: f.category === "all" ? undefined : f.category,
    stock: f.stock === "all" ? undefined : f.stock,
    sort: f.sort,
    page: f.page,
    page_size: f.pageSize,
  };
}
