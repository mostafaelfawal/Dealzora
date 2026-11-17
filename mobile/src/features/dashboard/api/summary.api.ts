import { api } from "@/api/instance";
import type { Summary } from "@/api/types";
import type { DateRange } from "@/lib/period";

/** ملخص الفترة للفروع المسموحة (أو فرع واحد). الخادم يفرض الصلاحية: فرع غير مسند = 404. */
export function fetchSummary(
  range: DateRange,
  branchId?: string,
  signal?: AbortSignal,
): Promise<Summary> {
  const params = new URLSearchParams({
    date_from: range.from,
    date_to: range.to,
  });
  if (branchId) params.set("branch_id", branchId);
  return api.get<Summary>(`/summary?${params.toString()}`, signal);
}
