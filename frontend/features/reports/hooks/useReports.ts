import { useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/lib/dates";

import {
  fetchDebtsReport,
  fetchProductsReport,
  fetchSalesReport,
  fetchTreasuryReport,
} from "../api/reports.api";
import { REPORT_LIMITS } from "../config/reportOptions";
import { reportKeys } from "../config/reportQueryKeys";
import type { ProductRank } from "../types/report";

export function useSalesReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.sales(range),
    queryFn: () => fetchSalesReport(range),
  });
}

export function useProductsReport(range: DateRange, rank: ProductRank) {
  return useQuery({
    queryKey: reportKeys.products(range, rank),
    queryFn: () => fetchProductsReport(range, rank, REPORT_LIMITS.products),
  });
}

export function useDebtsReport() {
  return useQuery({
    queryKey: reportKeys.debts(),
    queryFn: fetchDebtsReport,
  });
}

export function useTreasuryReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.treasury(range),
    queryFn: () => fetchTreasuryReport(range),
  });
}
