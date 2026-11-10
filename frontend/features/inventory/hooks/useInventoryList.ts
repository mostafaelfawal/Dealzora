import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getProducts } from "@/features/products/api/products.api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  DEFAULT_STAGNANT_DAYS,
  INVENTORY_PAGE_SIZES,
  INVENTORY_SEARCH_DEBOUNCE_MS,
} from "../config/inventoryOptions";
import { inventoryKeys } from "../config/inventoryQueryKeys";
import { stockRowFromProduct } from "../lib/inventoryRows";
import type { InventoryTab, StockRow } from "../types/inventory";
import { useStockReport } from "./useInventory";

/**
 * بيانات شاشة المخزون.
 * "راكد" يأتي من تقرير المخزون ويُقسَّم صفحات هنا، والباقي من قائمة المنتجات من الخادم.
 */
export function useInventoryList() {
  const [tab, setTabRaw] = useState<InventoryTab>("all");
  const [search, setSearchRaw] = useState("");
  const q = useDebouncedValue(search, INVENTORY_SEARCH_DEBOUNCE_MS);
  const [stagnantDays, setStagnantDays] = useState<string>(
    DEFAULT_STAGNANT_DAYS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(INVENTORY_PAGE_SIZES[0]);

  const isStagnant = tab === "stagnant";
  const report = useStockReport(Number(stagnantDays));
  const products = useQuery({
    queryKey: inventoryKeys.products(tab, q, page, pageSize),
    queryFn: () =>
      getProducts({
        q: q || undefined,
        stock: tab === "low" || tab === "out" ? tab : undefined,
        sort: "stock_asc",
        page,
        page_size: pageSize,
      }),
    enabled: !isStagnant,
    placeholderData: keepPreviousData,
  });

  const stagnantRows = (report.data?.stagnant ?? []).filter(
    (x) => !q || x.name.includes(q),
  );
  const rows: StockRow[] = isStagnant
    ? stagnantRows.slice((page - 1) * pageSize, page * pageSize)
    : (products.data?.items ?? []).map(stockRowFromProduct);

  // المصدر الفعّال للتبويب الحالي (حالة التحميل والخطأ وإعادة المحاولة).
  const source = isStagnant ? report : products;

  return {
    tab,
    setTab: (next: InventoryTab) => {
      setTabRaw(next);
      setPage(1);
    },
    search,
    setSearch: (next: string) => {
      setSearchRaw(next);
      setPage(1);
    },
    isFiltered: q !== "",
    clearSearch: () => setSearchRaw(""),
    stagnantDays,
    setStagnantDays,
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSizeRaw(size);
      setPage(1);
    },
    report: report.data,
    rows,
    total: isStagnant ? stagnantRows.length : (products.data?.total ?? 0),
    isLoading: source.isPending,
    isFetching: source.isFetching,
    isError: source.isError,
    error: source.error,
    refetch: () => void source.refetch(),
  };
}

export type InventoryList = ReturnType<typeof useInventoryList>;
