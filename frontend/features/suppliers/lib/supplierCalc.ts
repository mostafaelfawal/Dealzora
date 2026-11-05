import { normalizeDigits } from "@/lib/format";

/** يقبل الأرقام العربية والفاصلة. بيرجّع NaN لو فاضي أو غير صالح. */
export function parseNumber(text: string): number {
  const cleaned = normalizeDigits(text).replace(/[,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

export type BalanceStatus = "owed" | "settled" | "advance";

/** موجب = مستحق للمورد، صفر = مسدّد، سالب = دفعة مقدّمة. */
export const balanceStatus = (balance: number): BalanceStatus =>
  balance > 0 ? "owed" : balance < 0 ? "advance" : "settled";

export const BALANCE_LABEL: Record<BalanceStatus, string> = {
  owed: "مستحق له",
  settled: "مسدّد",
  advance: "دفعة مقدّمة",
};

export const BALANCE_TONE: Record<BalanceStatus, string> = {
  owed: "border-warning/50 text-warning",
  settled: "text-muted-foreground",
  advance: "border-success/50 text-success",
};
