export type CashDirection = "in" | "out";
export type CashKind = "expense" | "manual_in" | "manual_out";

export interface CashEntry {
  id: string;
  direction: CashDirection;
  kind: CashKind;
  /** بالجنيه، موجب دائماً (الاتجاه في direction). */
  amount: number;
  note: string;
  /** يوم الحركة (منتصف الليل المحلي). */
  occurredAt: number;
  /** مرتبطة بعملية أخرى (مصروف...): تُعدَّل أو تُحذف من مصدرها فقط. */
  isLinked: boolean;
  createdByName: string | null;
  createdAt: number;
  version: number;
}

/** ما يرسله الفورم للـ backend (حركة يدوية). */
export interface TreasuryInput {
  direction: CashDirection;
  amount: number;
  /** YYYY-MM-DD */
  occurredOn: string;
  note: string;
}

export type TreasuryDirectionFilter = CashDirection | "all";
export type TreasuryKindFilter = CashKind | "all";
export type TreasuryPeriod = "all" | "today" | "week" | "month";
export type TreasurySortKey =
  "newest" | "oldest" | "amount_desc" | "amount_asc";
export type TreasuryView = "cards" | "table";

export interface TreasuryFilters {
  direction: TreasuryDirectionFilter;
  kind: TreasuryKindFilter;
  period: TreasuryPeriod;
  sort: TreasurySortKey;
  page: number;
  pageSize: number;
}

export interface TreasurySummary {
  balance: number;
  totalIn: number;
  totalOut: number;
  todayIn: number;
  todayOut: number;
  monthIn: number;
  monthOut: number;
}
