import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchTreasury } from "../api/treasury.api";
import { treasuryKeys } from "../config/treasuryQueryKeys";
import type { TreasuryFilters } from "../types/treasury";

export default function useGetTreasury(filters: TreasuryFilters) {
  return useQuery({
    queryKey: treasuryKeys.list(filters),
    queryFn: () => fetchTreasury(filters),
    // نُبقي الصفحة القديمة ظاهرة أثناء تحميل الجديدة (بدون وميض).
    placeholderData: keepPreviousData,
  });
}
