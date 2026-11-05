import { useQuery } from "@tanstack/react-query";

import { fetchTreasurySummary } from "../api/treasury.api";
import { treasuryKeys } from "../config/treasuryQueryKeys";

export default function useGetTreasurySummary() {
  return useQuery({
    queryKey: treasuryKeys.summary(),
    queryFn: fetchTreasurySummary,
    staleTime: 0,
  });
}
