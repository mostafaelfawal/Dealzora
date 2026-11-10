import { moneyInputOrZero, parseNumberInput } from "@/lib/format";

import { CASH_DENOMINATIONS } from "../config/shiftOptions";

/** عدد ورقات كل فئة كما كتبها الكاشير (فئة ← نص). */
export type DenominationCounts = Record<number, string>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** عدد صحيح موجب، وأي إدخال غير صالح = 0. */
export function denominationCount(counts: DenominationCounts, d: number) {
  const n = parseNumberInput(counts[d] ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** إجمالي النقدية المعدودة = مجموع (الفئة × العدد) + المبالغ الأخرى. */
export function countedCash(counts: DenominationCounts, other: string) {
  const notes = CASH_DENOMINATIONS.reduce(
    (sum, d) => sum + d * denominationCount(counts, d),
    0,
  );
  return round2(notes + moneyInputOrZero(other));
}

/** الفرق عن المتوقع: موجب = زيادة، سالب = عجز. null لو المتوقع غير معروف. */
export const cashDifference = (counted: number, expected: number | null) =>
  expected === null ? null : round2(counted - expected);
