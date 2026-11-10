import { useState } from "react";

import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { round2 } from "@/features/pos/lib/posCalc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  DEFAULT_PAGE_SIZE,
  SALES_SEARCH_DEBOUNCE_MS,
} from "../config/saleOptions";
import type { ReturnReason } from "../types/sale";
import { useReturnsList } from "./useSales";

/** فلاتر سجل المرتجعات + القائمة + مجاميع الصفحة الحالية. */
export function useReturnsFilters() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, SALES_SEARCH_DEBOUNCE_MS);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("month"));
  const [reason, setReason] = useState<ReturnReason | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const list = useReturnsList({
    q,
    reason: reason === "all" ? undefined : reason,
    dateFrom: period.range.from,
    dateTo: period.range.to,
    page,
    pageSize,
  });
  const items = list.data?.items ?? [];

  const withPageReset =
    <T>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return {
    search,
    setSearch: withPageReset(setSearch),
    period,
    setPeriod: withPageReset(setPeriod),
    reason,
    setReason: withPageReset(setReason),
    page,
    setPage,
    pageSize,
    setPageSize: withPageReset(setPageSize),
    isFiltered: q !== "" || reason !== "all",
    clearFilters: () => {
      setSearch("");
      setReason("all");
    },
    list,
    items,
    totals: {
      value: round2(items.reduce((s, r) => s + r.total, 0)),
      cash: round2(items.reduce((s, r) => s + r.cashRefund, 0)),
      count: list.data?.total ?? 0,
    },
  };
}

export type ReturnsFilters = ReturnType<typeof useReturnsFilters>;
