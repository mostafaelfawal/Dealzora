import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/lib/dates";

import { fetchOverview } from "../api/dashboard.api";

/** "dashboard" يُبطَل تلقائياً بعد أي بيع/شراء/مرتجع (انظر useInvalidateAfterSale). */
export function useOverview(range: DateRange) {
  return useQuery({
    queryKey: ["dashboard", "overview", range],
    queryFn: () => fetchOverview(range),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
