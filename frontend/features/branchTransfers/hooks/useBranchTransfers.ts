import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  approveTransfer,
  cancelTransfer,
  connectBranch,
  disconnectBranch,
  fetchBranches,
  fetchBranchStatus,
  fetchCatalogStatus,
  fetchTransfer,
  fetchTransfers,
  fetchTransfersSummary,
  receiveTransfer,
  rejectTransfer,
  requestTransfer,
  retryPending,
  sendTransfer,
  syncCatalogNow,
  withdrawTransfer,
  type Transfer,
  type TransferStatus,
} from "../api/branchTransfers.api";

export const branchKeys = {
  all: ["branch-transfers"] as const,
  status: () => [...branchKeys.all, "status"] as const,
  branches: () => [...branchKeys.all, "branches"] as const,
  list: (direction: string, status?: string) =>
    [...branchKeys.all, "list", direction, status ?? "all"] as const,
  detail: (id: string) => [...branchKeys.all, "detail", id] as const,
  summary: () => [...branchKeys.all, "summary"] as const,
  catalog: () => [...branchKeys.all, "catalog"] as const,
};

export const useBranchStatus = () =>
  useQuery({
    queryKey: branchKeys.status(),
    queryFn: () => fetchBranchStatus(),
  });

export const useBranches = (enabled = true) =>
  useQuery({
    queryKey: branchKeys.branches(),
    queryFn: fetchBranches,
    enabled,
    staleTime: 30_000,
  });

export const useTransfers = (
  direction: "in" | "out" | "all",
  status: TransferStatus | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: branchKeys.list(direction, status),
    queryFn: () => fetchTransfers(direction, status),
    enabled,
    // التحويلات تيجي من فرع تاني عبر السيرفر: تحديث دوري خفيف.
    refetchInterval: 30_000,
    retry: false,
  });

export const useTransfer = (id: string | null) =>
  useQuery({
    queryKey: branchKeys.detail(id ?? ""),
    queryFn: () => fetchTransfer(id as string),
    enabled: Boolean(id),
    retry: false,
  });

export const useTransfersSummary = (enabled: boolean) =>
  useQuery({
    queryKey: branchKeys.summary(),
    queryFn: fetchTransfersSummary,
    enabled,
    refetchInterval: 30_000,
    retry: false,
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: branchKeys.all });
    // المخزون اتغيّر محلياً
    void qc.invalidateQueries({ queryKey: ["products"] });
    void qc.invalidateQueries({ queryKey: ["inventory"] });
    void qc.invalidateQueries({ queryKey: ["pos", "catalog"] });
    void qc.invalidateQueries({ queryKey: ["expiry"] });
  };
}

const fail = (fallback: string) => (e: unknown) =>
  toast.error(extractErrorMessage(e, fallback), { duration: 8000 });

export function useConnectBranch() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { serverUrl: string; code: string }) =>
      connectBranch(v.serverUrl, v.code),
    onSuccess: (s) => {
      refresh();
      toast.success(`اتربط الجهاز كـ «${s.branchName}» في «${s.shopName}»`);
    },
    onError: fail("تعذّر الربط"),
  });
}

export function useDisconnectBranch() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: disconnectBranch,
    onSuccess: () => {
      refresh();
      toast.success("اتفصل الجهاز عن سيرفر الفروع");
    },
    onError: fail("تعذّر الفصل"),
  });
}

function done(t: Transfer, ok: string) {
  if (t.queued)
    toast.warning(t.message ?? "اتخصم من المخزون، وهيتبعت أول ما السيرفر يرجع");
  else toast.success(ok);
}

export function useSendTransfer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      toBranchId: string;
      items: { productId: string; qty: number }[];
      note: string;
    }) => sendTransfer(v.toBranchId, v.items, v.note),
    onSuccess: (t) => {
      refresh();
      done(
        t,
        `اتبعت التحويل #${t.number} لـ ${t.toBranchName}، واتخصم من مخزونك`,
      );
    },
    onError: fail("تعذّر إرسال التحويل"),
  });
}

export function useRequestTransfer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      fromBranchId: string;
      items: { productId: string; qty: number }[];
      note: string;
    }) => requestTransfer(v.fromBranchId, v.items, v.note),
    onSuccess: (t) => {
      refresh();
      toast.success(`اتبعت طلب #${t.number} لـ ${t.fromBranchName}`);
    },
    onError: fail("تعذّر إرسال الطلب"),
  });
}

export function useApproveTransfer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      id: string;
      items: { lineId: string; qty: number; productId?: string }[];
    }) => approveTransfer(v.id, v.items),
    onSuccess: (t) => {
      refresh();
      done(
        t,
        `اتبعت الطلب #${t.number} لـ ${t.toBranchName}، واتخصم من مخزونك`,
      );
    },
    onError: fail("تعذّرت الموافقة"),
  });
}

export function useReceiveTransfer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      id: string;
      items: { lineId: string; qty: number; productId?: string }[];
      note: string;
    }) => receiveTransfer(v.id, v.items, v.note),
    onSuccess: (t) => {
      refresh();
      toast.success(
        t.status === "partial"
          ? `اتستلم التحويل #${t.number} بعجز، واللي وصل اتضاف لمخزونك`
          : `اتستلم التحويل #${t.number} واتضاف لمخزونك`,
      );
    },
    onError: fail("تعذّر الاستلام"),
  });
}

export function useTransferAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: {
      id: string;
      action: "reject" | "withdraw" | "cancel";
      reason?: string;
    }) =>
      v.action === "reject"
        ? rejectTransfer(v.id, v.reason ?? "")
        : v.action === "withdraw"
          ? withdrawTransfer(v.id)
          : cancelTransfer(v.id),
    onSuccess: (_t, v) => {
      refresh();
      toast.success(
        v.action === "reject"
          ? "اترفض الطلب"
          : v.action === "withdraw"
            ? "اتسحب الطلب"
            : "اتلغى التحويل ورجعت البضاعة لمخزونك",
      );
    },
    onError: fail("تعذّرت العملية"),
  });
}

export function useRetryPending() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: retryPending,
    onSuccess: (r) => {
      refresh();
      if (r.sent) toast.success(`اتبعت ${r.sent} تحويل كان معلّق`);
      else toast.info("السيرفر لسه مش متاح. هنحاول تاني تلقائياً");
    },
    onError: fail("تعذّرت إعادة الإرسال"),
  });
}

export const useCatalogStatus = (enabled: boolean) =>
  useQuery({
    queryKey: branchKeys.catalog(),
    queryFn: fetchCatalogStatus,
    enabled,
    refetchInterval: 60_000,
  });

export function useSyncCatalogNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncCatalogNow,
    onSuccess: (s) => {
      qc.setQueryData(branchKeys.catalog(), s);
      const r = s.result;
      if (!r) return;
      if (!r.ok) toast.error(r.error ?? "تعذّرت المزامنة");
      else if (r.applied || r.pushed)
        toast.success(`اتزامن: ${r.applied} تحديث وصل، و${r.pushed} اترفع`);
      else toast.success("كل حاجة متزامنة");
      if (r.applied) {
        void qc.invalidateQueries({ queryKey: ["products"] });
        void qc.invalidateQueries({ queryKey: ["customers"] });
      }
    },
    onError: fail("تعذّرت المزامنة"),
  });
}
