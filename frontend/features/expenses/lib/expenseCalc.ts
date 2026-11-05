import { round2 } from "@/features/pos/lib/posCalc";
import { normalizeDigits } from "@/lib/format";

import { EXPENSE_CATEGORIES } from "../config/expenseOptions";

/** يقبل الأرقام العربية والفاصلة. بيرجّع NaN لو فاضي أو غير صالح. */
export function parseAmount(text: string): number {
  const cleaned = normalizeDigits(text).replace(/[,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

export const amountOrZero = (value: number) =>
  Number.isFinite(value) ? round2(value) : 0;

const pad = (n: number) => String(n).padStart(2, "0");

/** تاريخ محلي بصيغة YYYY-MM-DD (بدون مشاكل المنطقة الزمنية). */
export const toYmd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayYmd = () => toYmd(new Date());

const dateFormat = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
export const formatDate = (ts: number) => dateFormat.format(ts);

export const categoryLabel = (id: string) =>
  EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? "أخرى";