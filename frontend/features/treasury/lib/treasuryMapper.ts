import type {
  CashEntry,
  TreasuryFilters,
  TreasuryInput,
  TreasurySummary,
} from "../types/treasury";
import type {
  CashEntryDto,
  ManualEntryPayload,
  TreasuryListParams,
  TreasurySummaryDto,
} from "../types/treasuryApi";
import { parseIsoDay, periodRange } from "./treasuryCalc";

/** قروش (backend) ⇄ جنيه (الواجهة). */
export const toPounds = (cents: number) => cents / 100;
export const toCents = (pounds: number) => Math.round(pounds * 100);

/** SQLite يرجّع datetime بدون منطقة زمنية (UTC)، فنضيف Z عند غيابها. */
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/i;
export const toMs = (iso: string): number =>
  Date.parse(HAS_TZ.test(iso) ? iso : `${iso}Z`);

export const toCashEntry = (dto: CashEntryDto): CashEntry => ({
  id: dto.id,
  direction: dto.direction,
  kind: dto.kind,
  amount: toPounds(dto.amount),
  note: dto.note ?? "",
  occurredAt: parseIsoDay(dto.occurred_at),
  isLinked: dto.source_entity !== null,
  createdByName: dto.created_by_name,
  createdAt: toMs(dto.created_at),
  version: dto.version,
});

export const toTreasurySummary = (
  dto: TreasurySummaryDto,
): TreasurySummary => ({
  balance: toPounds(dto.balance),
  totalIn: toPounds(dto.total_in),
  totalOut: toPounds(dto.total_out),
  todayIn: toPounds(dto.today_in),
  todayOut: toPounds(dto.today_out),
  monthIn: toPounds(dto.month_in),
  monthOut: toPounds(dto.month_out),
});

export const toManualPayload = (input: TreasuryInput): ManualEntryPayload => ({
  direction: input.direction,
  amount: toCents(input.amount),
  occurred_at: input.occurredOn,
  note: input.note,
});

export function toListParams(filters: TreasuryFilters): TreasuryListParams {
  const { dateFrom, dateTo } = periodRange(filters.period);
  return {
    direction: filters.direction === "all" ? undefined : filters.direction,
    kind: filters.kind === "all" ? undefined : filters.kind,
    date_from: dateFrom,
    date_to: dateTo,
    sort: filters.sort,
    page: filters.page,
    page_size: filters.pageSize,
  };
}
