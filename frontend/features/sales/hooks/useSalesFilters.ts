import { useState } from "react";

import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  DEFAULT_PAGE_SIZE,
  SALES_SEARCH_DEBOUNCE_MS,
} from "../config/saleOptions";
import type { PaymentMethod, SaleSort, SaleStatusFilter } from "../types/sale";
import { useSalesList } from "./useSales";

/** البحث برقم الفاتورة يتجاهل الفترة (الرقم فريد). */
const isInvoiceNumber = (q: string) => /^#?\d+$/.test(q.trim());

/** فلاتر سجل الفواتير + القائمة. أي تغيير في فلتر يرجع للصفحة الأولى. */
export function useSalesFilters() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, SALES_SEARCH_DEBOUNCE_MS);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("today"));
  const [method, setMethod] = useState<PaymentMethod | "all">("all");
  const [status, setStatus] = useState<SaleStatusFilter>("all");
  const [sort, setSort] = useState<SaleSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const byNumber = isInvoiceNumber(q);
  const list = useSalesList({
    q,
    method,
    status,
    sort,
    dateFrom: byNumber ? undefined : period.range.from,
    dateTo: byNumber ? undefined : period.range.to,
    page,
    pageSize,
  });

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
    method,
    setMethod: withPageReset(setMethod),
    status,
    setStatus: withPageReset(setStatus),
    sort,
    setSort: withPageReset(setSort),
    page,
    setPage,
    pageSize,
    setPageSize: withPageReset(setPageSize),
    isFiltered: q !== "" || method !== "all" || status !== "all",
    clearFilters: () => {
      setSearch("");
      setMethod("all");
      setStatus("all");
      setPage(1);
    },
    list,
  };
}

export type SalesFilters = ReturnType<typeof useSalesFilters>;
