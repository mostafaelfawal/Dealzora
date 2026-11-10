import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText } from "@/lib/format";

import {
  createReturn,
  fetchReturns,
  fetchSale,
  fetchSales,
  fetchSalesSummary,
} from "../api/sales.api";
import { saleKeys } from "../config/saleOptions";
import type { ReturnInput, SaleFilters } from "../types/sale";

export function useSalesList(filters: SaleFilters) {
  return useQuery({
    queryKey: saleKeys.list(filters),
    queryFn: () => fetchSales(filters),
    placeholderData: keepPreviousData,
  });
}

export function useSale(id: string | null) {
  return useQuery({
    queryKey: saleKeys.detail(id ?? ""),
    queryFn: () => fetchSale(id as string),
    enabled: Boolean(id),
  });
}

export function useSalesSummary() {
  return useQuery({ queryKey: saleKeys.summary(), queryFn: fetchSalesSummary });
}

export function useReturnsList(filters: Parameters<typeof fetchReturns>[0]) {
  return useQuery({
    queryKey: saleKeys.returns(filters),
    queryFn: () => fetchReturns(filters),
    placeholderData: keepPreviousData,
  });
}

/** بعد أي بيع/مرتجع: كل ما يتأثر (المخزون، العملاء، الخزنة، الوردية، اللوحة). */
export function useInvalidateAfterSale() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      saleKeys.all,
      ["products"],
      ["customers"],
      ["treasury"],
      ["shifts"],
      ["dashboard"],
      ["reports"],
      ["pos", "catalog"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function useCreateReturn() {
  const refresh = useInvalidateAfterSale();
  return useMutation({
    mutationFn: ({ saleId, input }: { saleId: string; input: ReturnInput }) =>
      createReturn(saleId, input),
    onSuccess: (ret) => {
      refresh();
      toast.success(`تم تسجيل المرتجع #${ret.number}`, {
        description:
          ret.cashRefund > 0
            ? `رُدّ للعميل ${formatMoneyText(ret.cashRefund)} نقداً`
            : `خُصم ${formatMoneyText(ret.creditRefund)} من حساب العميل`,
        duration: 8000,
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تسجيل المرتجع")),
  });
}
