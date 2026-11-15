/** نصوص وحسابات العرض لملخصات الفروع (بلا React، ومُختبرة). المال بالقروش والكميات × 1000. */
import type { SensitiveType, ShiftData } from "@/api/types";
import { formatArabicCount, normalizeDigits } from "@/lib/format";

export const SENSITIVE_LABEL: Record<SensitiveType, string> = {
  discount: "خصم كاشير فوق الحد",
  return: "مرتجع فوق الحد",
  full_return: "مرتجع فاتورة كاملة",
};

export type CashTone = "ok" | "short" | "over";

/** عجز (سالب) أو زيادة (موجب) في الدرج عند إغلاق الوردية. */
export function cashTone(s: Pick<ShiftData, "difference">): CashTone {
  if (s.difference < 0) return "short";
  if (s.difference > 0) return "over";
  return "ok";
}

export const CASH_LABEL: Record<CashTone, string> = { ok: "مطابق", short: "عجز", over: "زيادة" };

/** «بعد 10 أيام» / «اليوم» / «منتهي منذ يومين» (أيام تقويمية بتاريخ الهاتف). */
export function expiryText(expiry: string, today: Date = new Date()): string {
  const [y, m, d] = expiry.split("-").map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((target.getTime() - base.getTime()) / 86_400_000);
  const count = (n: number) => formatArabicCount(n, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" });
  if (days === 0) return "ينتهي اليوم";
  if (days > 0) return `ينتهي بعد ${count(days)}`;
  return `منتهي منذ ${count(-days)}`;
}

/** مبلغ بالجنيه من المستخدم ← قروش. null = غير صالح. */
export function parseMoneyInput(text: string): number | null {
  const cleaned = normalizeDigits(text).replace(/٫/g, ".").replace(/[,\s]/g, "");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
