import type { CashDirection, CashKind, TreasurySortKey } from "./treasury";

/** شكل الاستجابة كما يرجعها الـ backend (المال بالقروش، occurred_at تاريخ YYYY-MM-DD). */
export interface CashEntryDto {
  id: string;
  direction: CashDirection;
  kind: CashKind;
  amount: number;
  note: string | null;
  occurred_at: string;
  source_entity: string | null;
  source_id: string | null;
  created_by_name: string | null;
  version: number;
  created_at: string;
}

export interface CashListDto {
  items: CashEntryDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface TreasurySummaryDto {
  balance: number;
  total_in: number;
  total_out: number;
  today_in: number;
  today_out: number;
  month_in: number;
  month_out: number;
}

export interface TreasuryListParams {
  direction?: CashDirection;
  kind?: CashKind;
  date_from?: string;
  date_to?: string;
  sort: TreasurySortKey;
  page: number;
  page_size: number;
}

export interface ManualEntryPayload {
  direction: CashDirection;
  amount: number;
  occurred_at: string;
  note: string;
}
