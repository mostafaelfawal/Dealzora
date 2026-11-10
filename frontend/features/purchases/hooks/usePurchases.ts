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
  createPurchase,
  createPurchaseReturn,
  fetchAllProducts,
  fetchAllSuppliers,
  fetchPurchase,
  fetchPurchases,
  fetchPurchasesSummary,
} from "../api/purchases.api";
import type { PurchaseFilters, PurchaseInput, RefundMethod } from "../types/purchase";

export const purchaseKeys = {
  all: ["purchases"] as const,
  list: (f: PurchaseFilters) => [...purchaseKeys.all, "list", f] as const,
  detail: (id: string) => [...purchaseKeys.all, "detail", id] as const,
  summary: () => [...purchaseKeys.all, "summary"] as const,
  products: () => [...purchaseKeys.all, "products"] as const,
  suppliers: () => [...purchaseKeys.all, "suppliers"] as const,
};

export const usePurchasesList = (f: PurchaseFilters) =>
  useQuery({
    queryKey: purchaseKeys.list(f),
    queryFn: () => fetchPurchases(f),
    placeholderData: keepPreviousData,
  });

export const usePurchase = (id: string | null) =>
  useQuery({
    queryKey: purchaseKeys.detail(id ?? ""),
    queryFn: () => fetchPurchase(id as string),
    enabled: Boolean(id),
  });

export const usePurchasesSummary = () =>
  useQuery({ queryKey: purchaseKeys.summary(), queryFn: fetchPurchasesSummary });

export const usePurchaseProducts = () =>
  useQuery({ queryKey: purchaseKeys.products(), queryFn: fetchAllProducts, staleTime: 30_000 });

export const usePurchaseSuppliers = () =>
  useQuery({ queryKey: purchaseKeys.suppliers(), queryFn: fetchAllSuppliers, staleTime: 30_000 });

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const key of [purchaseKeys.all, ["products"], ["suppliers"], ["treasury"], ["reports"], ["dashboard"], ["pos", "catalog"]])
      void qc.invalidateQueries({ queryKey: key });
  };
}

export function useCreatePurchase() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: PurchaseInput) => createPurchase(input),
    onSuccess: (p) => {
      refresh();
      toast.success(`تم حفظ فاتورة الشراء #${p.number}`, {
        description:
          p.creditAmount > 0
            ? `${formatMoneyText(p.creditAmount)} آجل لـ ${p.supplierName}`
            : `دُفع ${formatMoneyText(p.paidAmount)} من الخزنة`,
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ فاتورة الشراء")),
  });
}

export function useCreatePurchaseReturn() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      purchaseId: string;
      refundMethod: RefundMethod;
      lines: { lineId: string; qty: number }[];
      note: string;
    }) => createPurchaseReturn(v.purchaseId, v.refundMethod, v.lines, v.note),
    onSuccess: (r, v) => {
      refresh();
      toast.success(`تم تسجيل مرتجع الشراء #${r.number}`, {
        description:
          v.refundMethod === "cash"
            ? `دخل الخزنة ${formatMoneyText(r.total)}`
            : `خُصم ${formatMoneyText(r.total)} من مستحقات المورد`,
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تسجيل المرتجع")),
  });
}
