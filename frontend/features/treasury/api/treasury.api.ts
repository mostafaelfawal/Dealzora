import { api } from "@/lib/axios";

import {
  toCashEntry,
  toListParams,
  toManualPayload,
  toTreasurySummary,
} from "../lib/treasuryMapper";
import type {
  CashEntry,
  TreasuryFilters,
  TreasuryInput,
  TreasurySummary,
} from "../types/treasury";
import type {
  CashEntryDto,
  CashListDto,
  TreasurySummaryDto,
} from "../types/treasuryApi";

/** الفلترة والترتيب والترقيم على السيرفر (GET /treasury). */
export const fetchTreasury = async (
  filters: TreasuryFilters,
): Promise<{ entries: CashEntry[]; total: number }> => {
  const { data } = await api.get<CashListDto>("/treasury", {
    params: toListParams(filters),
  });
  return { entries: data.items.map(toCashEntry), total: data.total };
};

export const fetchTreasurySummary = async (): Promise<TreasurySummary> =>
  toTreasurySummary(
    (await api.get<TreasurySummaryDto>("/treasury/summary")).data,
  );

/** إيداع/سحب يدوي. حركات المصروفات تُنشأ تلقائياً من موديول المصروفات. */
export const createManualEntry = async (
  input: TreasuryInput,
): Promise<CashEntry> =>
  toCashEntry(
    (await api.post<CashEntryDto>("/treasury/manual", toManualPayload(input)))
      .data,
  );

export const deleteCashEntry = async (id: string, baseVersion: number) => {
  await api.delete(`/treasury/${id}`, {
    params: { base_version: baseVersion },
  });
};
