import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  cancelOrder,
  createOrder,
  fetchOrder,
  fetchOrders,
  fetchOrdersSummary,
  fetchSuggestions,
  markOrderSent,
  updateOrder,
} from "../api/purchaseOrders.api";
import { purchaseOrderKeys } from "../config/purchaseOrderOptions";
import type {
  OrderInput,
  OrderStatusFilter,
  PurchaseOrder,
  ReorderSettings,
} from "../types/purchaseOrder";

export const useSuggestions = (s: ReorderSettings) =>
  useQuery({
    queryKey: purchaseOrderKeys.suggestions(s),
    queryFn: () => fetchSuggestions(s),
    placeholderData: keepPreviousData,
  });

export const useOrders = (
  status: OrderStatusFilter,
  page: number,
  pageSize: number,
) =>
  useQuery({
    queryKey: purchaseOrderKeys.list(status, page, pageSize),
    queryFn: () => fetchOrders(status, page, pageSize),
    placeholderData: keepPreviousData,
  });

export const useOrder = (id: string | null) =>
  useQuery({
    queryKey: purchaseOrderKeys.detail(id ?? ""),
    queryFn: () => fetchOrder(id as string),
    enabled: Boolean(id),
  });

export const useOrdersSummary = () =>
  useQuery({
    queryKey: purchaseOrderKeys.summary(),
    queryFn: fetchOrdersSummary,
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
}

/** ينشئ طلباً لكل مورد (الطلبات مستقلة: فشل واحد لا يلغي الباقي). */
export function useCreateOrders() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (inputs: OrderInput[]) => {
      const results = await Promise.allSettled(inputs.map(createOrder));
      const created = results
        .filter(
          (r): r is PromiseFulfilledResult<PurchaseOrder> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      const failed = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      return { created, failed: failed?.reason as unknown };
    },
    onSuccess: ({ created, failed }) => {
      refresh();
      if (created.length === 1)
        toast.success(
          `تم إنشاء طلب الشراء #${created[0].number} لـ ${created[0].supplierName}`,
        );
      else if (created.length > 1)
        toast.success(`تم إنشاء ${created.length} طلبات شراء`, {
          description: created.map((o) => o.supplierName).join("، "),
        });
      if (failed)
        toast.error(extractErrorMessage(failed, "تعذّر إنشاء بعض الطلبات"));
    },
  });
}

export function useUpdateOrder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { order: PurchaseOrder; input: OrderInput }) =>
      updateOrder(v.order.id, v.order.version, v.input),
    onSuccess: (o) => {
      refresh();
      toast.success(`تم حفظ طلب الشراء #${o.number}`);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ الطلب")),
  });
}

export function useMarkSent() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (o: PurchaseOrder) => markOrderSent(o.id, o.version),
    onSuccess: refresh,
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تحديث الطلب")),
  });
}

export function useCancelOrder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (o: PurchaseOrder) => cancelOrder(o.id, o.version),
    onSuccess: (o) => {
      refresh();
      toast.success(`أُلغي طلب الشراء #${o.number}`);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر إلغاء الطلب")),
  });
}
