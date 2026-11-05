import { round2 } from "@/features/pos/lib/posCalc";
import { normalizeDigits } from "@/lib/format";

import type { TreasuryPeriod } from "../types/treasury";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7; // "آخر 7 أيام" شامل اليوم (نفس منطق المصروفات)

/** يقبل الأرقام العربية والفاصلة. بيرجّع NaN لو فاضي أو غير صالح. */
export function parseAmount(text: string): number {
  const cleaned = normalizeDigits(text).replace(/[,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

export const amountOrZero = (value: number) =>
  Number.isFinite(value) ? round2(value) : 0;

const pad = (n: number) => String(n).padStart(2, "0");

/** تاريخ محلي بصيغة YYYY-MM-DD (لا نستخدم toISOString لأنه UTC). */
export const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = () => toIsoDay(new Date());

/** YYYY-MM-DD → منتصف الليل المحلي بالـ ms. */
export function parseIsoDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** حدود الفترة المختارة كتواريخ YYYY-MM-DD (نفس منطق period_starts في الـ backend). */
export function periodRange(
  period: TreasuryPeriod,
  now = new Date(),
): { dateFrom?: string; dateTo?: string } {
  const today = toIsoDay(now);
  switch (period) {
    case "today":
      return { dateFrom: today, dateTo: today };
    case "week": {
      const from = new Date(now);
      from.setDate(from.getDate() - (WEEK_DAYS - 1));
      return { dateFrom: toIsoDay(from), dateTo: today };
    }
    case "month":
      return {
        dateFrom: toIsoDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        dateTo: today,
      };
    default:
      return {};
  }
}

const dateFormat = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
export const formatDate = (ts: number) => dateFormat.format(ts);

/** "اليوم" / "أمس" / تاريخ كامل. */
export function formatDayLabel(ts: number, now = new Date()) {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const days = Math.round((startOfToday - ts) / DAY_MS);
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  return formatDate(ts);
}
