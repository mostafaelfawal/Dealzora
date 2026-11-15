import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { ApiError, errorMessage } from "@/api/errors";
import type { Transfer } from "@/api/types";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

import {
  approveTransfer,
  cancelApproval,
  fetchTransfer,
  fetchTransfers,
  rejectTransfer,
  type ApproveLine,
  type TransferFilter,
} from "../api/transfers.api";
import { approvalBusy } from "../lib/transferText";

export const transferKeys = {
  all: ["transfers"] as const,
  list: (filter: TransferFilter) => ["transfers", "list", filter] as const,
  one: (id: string) => ["transfers", "one", id] as const,
};

export function useTransfers(filter: TransferFilter) {
  const live = useLiveRefresh(true);
  return useInfiniteQuery({
    queryKey: transferKeys.list(filter),
    queryFn: ({ pageParam, signal }) => fetchTransfers(filter, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * 30 < last.total ? pages.length + 1 : undefined),
    ...live,
  });
}

/** موافقة تنتظر الفرع: نتابعها كل 15 ثانية والشاشة ظاهرة (الفرع يزامن كل دقيقة تقريباً). */
export function useTransfer(id: string) {
  const live = useLiveRefresh(true);
  return useQuery({
    queryKey: transferKeys.one(id),
    queryFn: ({ signal }) => fetchTransfer(id, signal),
    ...live,
    refetchInterval: (q) =>
      live.refetchInterval === false ? false : approvalBusy(q.state.data?.approval ?? null) ? 15_000 : 60_000,
  });
}

/**
 * إجراءات الهاتف. التعارض (تغيّر الطلب من جهاز آخر) يرجع من الخادم بالحالة الحالية: نعرضها فوراً
 * مع رسالة واضحة، ولا نعيد المحاولة تلقائياً (لا تنفيذ مزدوج).
 */
export function useTransferActions(id: string) {
  const qc = useQueryClient();

  const onDone = (t: Transfer) => {
    qc.setQueryData(transferKeys.one(id), t);
    void qc.invalidateQueries({ queryKey: ["transfers", "list"] });
  };

  const onError = (title: string) => (e: unknown) => {
    if (e instanceof ApiError && e.code === "transfer_changed") {
      const current = (e.details as { transfer?: Transfer } | null)?.transfer;
      if (current) qc.setQueryData(transferKeys.one(id), current);
      void qc.invalidateQueries({ queryKey: transferKeys.all });
      Alert.alert("تغيّر الطلب من جهاز آخر", `${e.message}. تم تحديث الشاشة بالحالة الحالية.`);
      return;
    }
    if (e instanceof ApiError && (e.code === "approval_pending" || e.code === "approval_in_progress")) {
      void qc.invalidateQueries({ queryKey: transferKeys.all });
    }
    Alert.alert(title, errorMessage(e));
  };

  const approve = useMutation({
    mutationFn: (v: { t: Transfer; lines: ApproveLine[]; note?: string }) => approveTransfer(v.t, v.lines, v.note),
    onSuccess: onDone,
    onError: onError("تعذّرت الموافقة"),
  });
  const reject = useMutation({
    mutationFn: (v: { t: Transfer; reason: string }) => rejectTransfer(v.t, v.reason),
    onSuccess: onDone,
    onError: onError("تعذّر الرفض"),
  });
  const cancel = useMutation({
    mutationFn: () => cancelApproval(id),
    onSuccess: onDone,
    onError: onError("تعذّر إلغاء الموافقة"),
  });
  return { approve, reject, cancel };
}
