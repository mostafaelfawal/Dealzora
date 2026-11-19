import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  bulkPublish,
  fetchStoreOrder,
  fetchStoreOrders,
  fetchStoreProducts,
  fetchStoreState,
  fetchStoreSummary,
  saveStore,
  saveTheme,
  setOrderNote,
  setOrderStatus,
  updateStoreProduct,
  uploadStoreImage,
} from "../api/store.api";
import { ORDER_STATUS } from "../lib/storeText";
import type {
  OrderFilter,
  OrderStatus,
  ProductFilter,
  StoreProductPatch,
} from "../types/store";

export const storeKeys = {
  all: ["online-store"] as const,
  state: () => [...storeKeys.all, "state"] as const,
  summary: () => [...storeKeys.all, "summary"] as const,
  products: (p: object) => [...storeKeys.all, "products", p] as const,
  orders: (p: object) => [...storeKeys.all, "orders", p] as const,
  order: (id: string) => [...storeKeys.all, "order", id] as const,
};

export const useStoreState = (enabled = true) =>
  useQuery({
    queryKey: storeKeys.state(),
    queryFn: fetchStoreState,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

/** الطلبات الجديدة تصل من الإنترنت في أي وقت: فحص كل دقيقة. */
export const useStoreSummary = (enabled = true) =>
  useQuery({
    queryKey: storeKeys.summary(),
    queryFn: fetchStoreSummary,
    enabled,
    refetchInterval: 60_000,
    retry: 1,
  });

export const useStoreProducts = (params: {
  q?: string;
  status: ProductFilter;
  category?: string;
  page: number;
  pageSize: number;
}) =>
  useQuery({
    queryKey: storeKeys.products(params),
    queryFn: () => fetchStoreProducts(params),
    placeholderData: keepPreviousData,
  });

export const useStoreOrders = (params: {
  status: OrderFilter;
  q?: string;
  page: number;
  pageSize: number;
}) =>
  useQuery({
    queryKey: storeKeys.orders(params),
    queryFn: () => fetchStoreOrders(params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

export const useStoreOrder = (id: string | null) =>
  useQuery({
    queryKey: storeKeys.order(id ?? ""),
    queryFn: () => fetchStoreOrder(id as string),
    enabled: id !== null,
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: storeKeys.all });
}

export function useSaveStore() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: saveStore,
    onSuccess: (s) => {
      refresh();
      toast.success("تم حفظ إعدادات المتجر", {
        description: s.live
          ? "التغييرات ظاهرة للزوار الآن."
          : s.isPublished
            ? undefined
            : "المتجر غير منشور بعد: لن يراه الزوار حتى تنشره.",
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ المتجر")),
  });
}

export function useSaveTheme() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: saveTheme,
    onSuccess: (s) => {
      refresh();
      toast.success("حُفظ مظهر المتجر", {
        description: s.live ? "التغييرات ظاهرة للزوار الآن." : undefined,
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ المظهر")),
  });
}

export function useUploadStoreImage() {
  return useMutation({
    mutationFn: uploadStoreImage,
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر رفع الصورة")),
  });
}

export function useUpdateStoreProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { gid: string; patch: StoreProductPatch }) =>
      updateStoreProduct(v.gid, v.patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...storeKeys.all, "products"] });
      void qc.invalidateQueries({ queryKey: storeKeys.summary() });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تحديث الصنف")),
  });
}

export function useBulkPublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkPublish,
    onSuccess: (r, v) => {
      void qc.invalidateQueries({ queryKey: [...storeKeys.all, "products"] });
      void qc.invalidateQueries({ queryKey: storeKeys.summary() });
      toast.success(
        v.isPublished
          ? `عُرض ${r.changed} صنف في المتجر`
          : `أُخفي ${r.changed} صنف من المتجر`,
      );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تحديث الأصناف")),
  });
}

export function useSetOrderStatus() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      id: string;
      status: Exclude<OrderStatus, "new">;
      reason?: string;
    }) => setOrderStatus(v.id, { status: v.status, reason: v.reason }),
    onSuccess: (o) => {
      refresh();
      toast.success(`الطلب #${o.number}: ${ORDER_STATUS[o.status].label}`);
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر تحديث حالة الطلب")),
  });
}

export function useSetOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; note: string | null }) =>
      setOrderNote(v.id, v.note),
    onSuccess: (o) => {
      qc.setQueryData(storeKeys.order(o.id), o);
      toast.success("حُفظت الملاحظة");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ الملاحظة")),
  });
}
