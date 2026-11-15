/** تحويلات الفروع من الهاتف. الصلاحيات والتعارض يفرضهما الخادم. */
import { api } from "@/api/instance";
import type { Transfer, TransferList, TransferStatus } from "@/api/types";

export type TransferFilter = "needs_action" | "all" | TransferStatus;

export function fetchTransfers(filter: TransferFilter, page: number, signal?: AbortSignal): Promise<TransferList> {
  const params = new URLSearchParams({ page: String(page), page_size: "30" });
  if (filter === "needs_action") params.set("needs_action", "true");
  else if (filter !== "all") params.set("status", filter);
  return api.get<TransferList>(`/transfers?${params.toString()}`, signal);
}

export const fetchTransfer = (id: string, signal?: AbortSignal) =>
  api.get<Transfer>(`/transfers/${encodeURIComponent(id)}`, signal);

export interface ApproveLine {
  line_id: string;
  /** × 1000، و0 = غير متوفر */
  qty: number;
}

/** موافقة ينفّذها جهاز الفرع المطلوب منه (خصم المخزون والتكلفة) مع مزامنته التالية. */
export const approveTransfer = (t: Pick<Transfer, "id" | "version">, lines: ApproveLine[], note?: string) =>
  api.post<Transfer>(`/transfers/${encodeURIComponent(t.id)}/approve`, { version: t.version, lines, note: note || null });

export const rejectTransfer = (t: Pick<Transfer, "id" | "version">, reason: string) =>
  api.post<Transfer>(`/transfers/${encodeURIComponent(t.id)}/reject`, { version: t.version, reason });

export const cancelApproval = (id: string) => api.post<Transfer>(`/transfers/${encodeURIComponent(id)}/approval/cancel`);
