import type { TreasuryFilters } from "../types/treasury";

export const treasuryKeys = {
  all: ["treasury"] as const,
  list: (filters: TreasuryFilters) =>
    [...treasuryKeys.all, "list", filters] as const,
  summary: () => [...treasuryKeys.all, "summary"] as const,
};
