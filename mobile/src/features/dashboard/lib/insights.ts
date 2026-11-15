/**
 * منطق العرض (بلا React، ومُختبر): نسبة التغيّر، الفروع التي لم ترسل بياناتها، ونصوص حالة الفرع.
 */
import type { BranchStatus, BranchTotals, Summary } from "@/api/types";
import { formatArabicCount } from "@/lib/format";

export interface Change {
  /** نسبة مئوية مقرّبة لرقم عشري واحد، أو null لو المقارنة صفر (لا معنى للنسبة). */
  pct: number | null;
  diff: number;
  direction: "up" | "down" | "flat";
}

export function change(current: number, previous: number): Change {
  const diff = current - previous;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  if (previous === 0) return { pct: null, diff, direction };
  return { pct: Math.round((diff / Math.abs(previous)) * 1000) / 10, diff, direction };
}

/** «+12.5%» / «−3%» / «بدون تغيير» / null (لا مقارنة). أرقام لاتينية. */
export function formatChange(c: Change): string | null {
  if (c.direction === "flat") return "بدون تغيير";
  if (c.pct === null) return null;
  const sign = c.pct > 0 ? "+" : "−";
  return `${sign}${Math.abs(c.pct)}%`;
}

export type Coverage = "complete" | "partial" | "none";

/** الفرع أرسل كل أيام الفترة؟ none = لم يرسل شيئاً (لا تُعرض أرقامه كأنها صفر). */
export function branchCoverage(b: Pick<BranchTotals, "reported_days" | "expected_days">): Coverage {
  if (b.expected_days === 0 || b.reported_days >= b.expected_days) return "complete";
  return b.reported_days === 0 ? "none" : "partial";
}

/** الفروع النشطة التي تنقصها بيانات في الفترة. */
export function missingBranches(summary: Summary): BranchTotals[] {
  return summary.branches.filter((b) => b.is_active && branchCoverage(b) !== "complete");
}

/** «لم يرسل بيانات اليوم بعد» / «ناقص يومين من الفترة». */
export function coverageLabel(b: Pick<BranchTotals, "reported_days" | "expected_days">, singleDay: boolean): string | null {
  const cov = branchCoverage(b);
  if (cov === "complete") return null;
  if (cov === "none") return singleDay ? "لم يرسل بيانات هذا اليوم بعد" : "لم يرسل بيانات هذه الفترة بعد";
  const missing = b.expected_days - b.reported_days;
  return `ناقص ${formatArabicCount(missing, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" })} من الفترة`;
}

function ago(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatArabicCount(Math.max(minutes, 1), { one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة" });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatArabicCount(hours, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" });
  const days = Math.floor(hours / 24);
  return formatArabicCount(days, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" });
}

export const STATUS_LABEL: Record<BranchStatus, string> = {
  online: "متصل",
  late: "متأخر",
  offline: "منقطع",
  never: "لم يتصل بعد",
  disabled: "موقوف",
};

/** «متصل الآن» / «متأخر · آخر ظهور منذ 10 دقائق» / «منقطع منذ 3 ساعات». */
export function statusText(status: BranchStatus, secondsSinceSeen: number | null): string {
  if (status === "online") return "متصل الآن";
  if (status === "never") return "لم يتصل بالخادم بعد";
  if (secondsSinceSeen === null) return STATUS_LABEL[status];
  if (status === "late") return `متأخر · آخر ظهور منذ ${ago(secondsSinceSeen)}`;
  if (status === "offline") return `منقطع منذ ${ago(secondsSinceSeen)}`;
  return `موقوف · آخر ظهور منذ ${ago(secondsSinceSeen)}`;
}

/** تأخر المزامنة: أحداث من باقي الفروع لم يطبّقها الفرع بعد. */
export function syncLagText(pending: number): string | null {
  if (pending <= 0) return null;
  return `${formatArabicCount(pending, { one: "تحديث واحد", two: "تحديثان", few: "تحديثات", many: "تحديثًا" })} من الفروع الأخرى لم يصل له بعد`;
}
