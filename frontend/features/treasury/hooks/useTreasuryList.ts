import { useCallback, useState } from "react";

import { DEFAULT_PAGE_SIZE } from "../config/treasuryOptions";
import type {
  CashEntry,
  TreasuryFilters,
  TreasurySummary,
} from "../types/treasury";
import useGetTreasury from "./useGetTreasury";
import useGetTreasurySummary from "./useGetTreasurySummary";

const DEFAULT_FILTERS: TreasuryFilters = {
  direction: "all",
  kind: "all",
  period: "all",
  sort: "newest",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};
const NONE: CashEntry[] = [];
const ZERO_SUMMARY: TreasurySummary = {
  balance: 0,
  totalIn: 0,
  totalOut: 0,
  todayIn: 0,
  todayOut: 0,
  monthIn: 0,
  monthOut: 0,
};

/** قائمة الخزنة: الفلترة والترتيب والترقيم كلها على السيرفر. */
export function useTreasuryList() {
  const [filters, setFilters] = useState<TreasuryFilters>(DEFAULT_FILTERS);
  const query = useGetTreasury(filters);
  const summaryQuery = useGetTreasurySummary();

  const entries = query.data?.entries ?? NONE;
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);

  // بعد حذف آخر عنصر في صفحة أخيرة: نرجع لآخر صفحة موجودة.
  // تعديل الـ state أثناء الـ render (نمط React الرسمي) بدل useEffect: لا render زائد.
  // يتوقف تلقائياً لأن الشرط يصير false بعد التعديل.
  if (query.data && filters.page > pageCount) {
    setFilters((prev) => ({ ...prev, page: pageCount }));
  }

  const patchFilters = useCallback((partial: Partial<TreasuryFilters>) => {
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
    entries,
    total,
    page,
    filters,
    summary: summaryQuery.data ?? ZERO_SUMMARY,
    filtered:
      filters.direction !== "all" ||
      filters.kind !== "all" ||
      filters.period !== "all",
    patchFilters,
    clearFilters,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
