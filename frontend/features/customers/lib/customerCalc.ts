import { round2 } from "@/features/pos/lib/posCalc";
import { normalizeDigits } from "@/lib/format";

import { NEAR_LIMIT_RATIO, OVERDUE_DAYS } from "../config/customerOptions";
import type { CreditLevel, Customer } from "../types/customer";

const DAY_MS = 86_400_000;

/** يقبل الأرقام العربية والفاصلة. بيرجّع NaN لو فاضي أو غير صالح. */
export function parseAmount(text: string): number {
  const cleaned = normalizeDigits(text).replace(/[,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

export const amountOrZero = (value: number) =>
  Number.isFinite(value) ? round2(value) : 0;

export const availableCredit = (c: Pick<Customer, "balance" | "creditLimit">) =>
  Math.max(round2(c.creditLimit - c.balance), 0);

/** نسبة استهلاك الحد الائتماني (0 إلى 1). */
export function creditRatio(c: Pick<Customer, "balance" | "creditLimit">) {
  if (c.creditLimit <= 0) return c.balance > 0 ? 1 : 0;
  return Math.min(Math.max(c.balance, 0) / c.creditLimit, 1);
}

export function getCreditLevel(
  c: Pick<Customer, "balance" | "creditLimit">,
): CreditLevel {
  if (c.creditLimit <= 0) return "cash";
  const ratio = creditRatio(c);
  if (ratio >= 1) return "full";
  if (ratio >= NEAR_LIMIT_RATIO) return "warn";
  return "ok";
}

/** متأخر = عليه دين ومرّ أكثر من OVERDUE_DAYS على آخر دفعة (أو على إضافته لو لم يدفع قط). */
export function isOverdue(c: Customer, now = Date.now()) {
  if (c.balance <= 0) return false;
  const since = c.lastPaymentAt ?? c.createdAt;
  return now - since > OVERDUE_DAYS * DAY_MS;
}

const dateFormat = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
export const formatDate = (ts: number) => dateFormat.format(ts);

/** "اليوم" / "أمس" / "منذ 5 أيام". */
export function formatDaysAgo(ts: number | null, now = Date.now()) {
  if (ts === null) return "—";
  const days = Math.floor((now - ts) / DAY_MS);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days === 2) return "قبل يومين";
  if (days <= 10) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${days} يوماً`;
  const months = Math.floor(days / 30);
  if (months === 1) return "منذ شهر";
  if (months === 2) return "منذ شهرين";
  if (months <= 10) return `منذ ${months} أشهر`;
  return `منذ ${months} شهراً`;
}

export const initialOf = (name: string) => [...name.trim()][0] ?? "؟";

export const cleanName = (text: string) =>
  text.split(/\s+/).filter(Boolean).join(" ");

export const cleanPhone = (text: string) =>
  normalizeDigits(text).replace(/[\s\-()]/g, "");
