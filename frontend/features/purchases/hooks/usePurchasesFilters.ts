import { useState } from "react";

import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  PURCHASE_DEFAULT_PAGE_SIZE,
  PURCHASE_SEARCH_DEBOUNCE_MS,
} from "../config/purchaseOptions";
import type { PurchaseStatusFilter } from "../types/purchase";
import { usePurchasesList } from "./usePurchases";

/** البحث برقم فاتورة يتجاهل الفترة حتى يجدها أياً كان تاريخها. */
const isInvoiceNumber = (q: string) => /^#?\d+$/.test(q.trim());

/** فلاتر شاشة المشتريات + القائمة. أي تغيير في فلتر يرجع للصفحة الأولى. */
export function usePurchasesFilters() {
  const [search, setSearchRaw] = useState("");
  const q = useDebouncedValue(search, PURCHASE_SEARCH_DEBOUNCE_MS);
  const [period, setPeriodRaw] = useState<PeriodValue>(periodOf("month"));
  const [status, setStatusRaw] = useState<PurchaseStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(PURCHASE_DEFAULT_PAGE_SIZE);

  const byNumber = isInvoiceNumber(q);
  const list = usePurchasesList({
    q,
    status,
    dateFrom: byNumber ? undefined : period.range.from,
    dateTo: byNumber ? undefined : period.range.to,
    page,
    pageSize,
  });

  const resetPage =
    <T>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return {
    search,
    setSearch: resetPage(setSearchRaw),
    period,
    setPeriod: resetPage(setPeriodRaw),
    status,
    setStatus: resetPage(setStatusRaw),
    page,
    setPage,
    pageSize,
    setPageSize: resetPage(setPageSizeRaw),
    isFiltered: q !== "" || status !== "all",
    clearFilters: () => {
      setSearchRaw("");
      setStatusRaw("all");
    },
    list,
  };
}
