import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/lib/dates";
import { useFallbackInterval } from "@/lib/realtime";

import { fetchOverview } from "../api/dashboard.api";

/** "dashboard" يُبطَل تلقائياً بعد أي بيع/شراء/مرتجع (انظر useInvalidateAfterSale). */
export function useOverview(range: DateRange) {
  // مع البث اللحظي: يتحدث فور أي بيع من أي جهاز. الـ polling احتياط عند انقطاعه.
  const interval = useFallbackInterval(60_000);
  return useQuery({
    queryKey: ["dashboard", "overview", range],
    queryFn: () => fetchOverview(range),
    placeholderData: keepPreviousData,
    refetchInterval: interval,
  });
}
