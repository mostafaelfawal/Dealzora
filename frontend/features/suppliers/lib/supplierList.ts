import type { GetSuppliersParams } from "../api/suppliers.api";
import type { SupplierFilters, SuppliersSummary } from "../types/supplier";

export const DEFAULT_FILTERS: SupplierFilters = {
  query: "",
  balance: "all",
  sort: "name_asc",
  page: 1,
  pageSize: 24,
};

export const EMPTY_SUMMARY: SuppliersSummary = {
  total: 0,
  owed: 0,
  inactive: 0,
  totalPayable: 0,
};

export const isFiltered = (f: SupplierFilters) =>
  f.query.trim() !== "" || f.balance !== "all";

/** يحوّل حالة الفلاتر إلى query params. القيم الافتراضية لا تُرسل. */
export function toListParams(f: SupplierFilters): GetSuppliersParams {
  return {
    q: f.query.trim() || undefined,
    balance: f.balance === "all" ? undefined : f.balance,
    sort: f.sort,
    page: f.page,
    page_size: f.pageSize,
  };
}
