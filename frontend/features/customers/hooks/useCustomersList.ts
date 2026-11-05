import { useCallback, useMemo, useState } from "react";

import { DEFAULT_PAGE_SIZE } from "../config/customerOptions";
import { filterCustomers, sortCustomers, summarize } from "../lib/customerList";
import type { Customer, CustomerFilters } from "../types/customer";
import useGetCustomers from "./useGetCustomers";

const DEFAULT_FILTERS: CustomerFilters = {
  query: "",
  filter: "all",
  sort: "debt",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};
const NONE: Customer[] = [];

/**
 * قائمة العملاء: بحث + فلتر + ترتيب + ترقيم صفحات (كلها على جهة العميل حالياً).
 * عند الربط بالـ backend انقل الفلترة والترقيم للسيرفر وأبقِ نفس القيم المُرجعة.
 */
export function useCustomersList() {
  const query = useGetCustomers();
  const all = query.data ?? NONE;
  const [filters, setFilters] = useState<CustomerFilters>(DEFAULT_FILTERS);

  const summary = useMemo(() => summarize(all), [all]);

  const matching = useMemo(
    () => sortCustomers(filterCustomers(all, filters), filters.sort),
    [all, filters],
  );

  const pageCount = Math.max(1, Math.ceil(matching.length / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const customers = useMemo(
    () =>
      matching.slice((page - 1) * filters.pageSize, page * filters.pageSize),
    [matching, page, filters.pageSize],
  );

  const patchFilters = useCallback((partial: Partial<CustomerFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...("page" in partial ? {} : { page: 1 }),
      ...partial,
    }));
  }, []);

  const clearFilters = useCallback(
    () =>
      setFilters((prev) => ({ ...DEFAULT_FILTERS, pageSize: prev.pageSize })),
    [],
  );

  return {
    all,
    customers,
    total: matching.length,
    page,
    filters,
    summary,
    filtered: filters.query.trim() !== "" || filters.filter !== "all",
    patchFilters,
    clearFilters,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
