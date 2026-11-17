import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/lib/dates";

import {
  fetchCashiersReport,
  fetchCustomersReport,
  fetchDebtsReport,
  fetchProductsReport,
  fetchPromotionsReport,
  fetchPurchasesReport,
  fetchReturnsReport,
  fetchSalesReport,
  fetchTreasuryReport,
} from "../api/reports.api";
import { REPORT_LIMITS } from "../config/reportOptions";
import { reportKeys } from "../config/reportQueryKeys";
import type { ProductRank } from "../types/report";

export function useSalesReport(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: reportKeys.sales(range),
    queryFn: () => fetchSalesReport(range),
    enabled,
  });
}

export function useProductsReport(
  range: DateRange,
  rank: ProductRank,
  categoryId: string | null,
) {
  return useQuery({
    queryKey: reportKeys.products(range, rank, categoryId),
    queryFn: () =>
      fetchProductsReport(range, rank, REPORT_LIMITS.products, categoryId),
    // تغيير القسم أو الترتيب لا يمسح الشاشة (قائمة الأقسام تبقى ظاهرة).
    placeholderData: keepPreviousData,
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

export function usePurchasesReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.purchases(range),
    queryFn: () => fetchPurchasesReport(range),
  });
}

export function usePromotionsReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.promotions(range),
    queryFn: () => fetchPromotionsReport(range),
  });
}

export function useReturnsReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.returns(range),
    queryFn: () => fetchReturnsReport(range),
  });
}

export function useCustomersReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.customers(range),
    queryFn: () => fetchCustomersReport(range),
  });
}

export function useCashiersReport(range: DateRange) {
  return useQuery({
    queryKey: reportKeys.cashiers(range),
    queryFn: () => fetchCashiersReport(range),
  });
}
