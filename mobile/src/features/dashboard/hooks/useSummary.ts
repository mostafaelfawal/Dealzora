import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { includesToday, type DateRange } from "@/lib/period";

import { fetchSummary } from "../api/summary.api";

export const summaryKey = (range: DateRange, branchId?: string) =>
  ["summary", range.from, range.to, branchId ?? "all"] as const;

export function useSummary(range: DateRange, branchId?: string) {
  const live = useLiveRefresh(includesToday(range));
  return useQuery({
    queryKey: summaryKey(range, branchId),
    queryFn: ({ signal }) => fetchSummary(range, branchId, signal),
    // تغيير الفترة يُبقي الأرقام السابقة ظاهرة (باهتة) حتى تصل الجديدة، بدل وميض فارغ.
    placeholderData: keepPreviousData,
    ...live,
  });
}
