/**
 * فترات التقارير بتاريخ الهاتف المحلي — نفس تعريفات frontend/lib/dates.ts (presetRange) حتى تتطابق
 * الأرقام مع «تقرير الفروع» في البرنامج: «الأسبوع» = آخر 7 أيام، «الشهر» = من أول الشهر حتى اليوم.
 */

export type PeriodPreset = "today" | "yesterday" | "week" | "month" | "custom";

export interface DateRange {
  /** YYYY-MM-DD */
  from: string;
  to: string;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "اليوم",
  yesterday: "أمس",
  week: "آخر 7 أيام",
  month: "هذا الشهر",
  custom: "مخصص",
};

/** أقصى طول للفترة المخصصة (حد الخادم: سنة). */
export const MAX_RANGE_DAYS = 366;

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD محلي (لا toISOString لأنه UTC). */
export const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** YYYY-MM-DD ← منتصف الليل المحلي. */
export function parseIsoDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function presetRange(
  preset: Exclude<PeriodPreset, "custom">,
  now = new Date(),
): DateRange {
  const today = toIsoDay(now);
  switch (preset) {
    case "yesterday": {
      const y = toIsoDay(addDays(now, -1));
      return { from: y, to: y };
    }
    case "week":
      return { from: toIsoDay(addDays(now, -6)), to: today };
    case "month":
      return {
        from: toIsoDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };
    default:
      return { from: today, to: today };
  }
}

export function rangeDays(range: DateRange): number {
  return (
    Math.round(
      (parseIsoDay(range.to).getTime() - parseIsoDay(range.from).getTime()) /
        86_400_000,
    ) + 1
  );
}

/** الفترة تشمل اليوم (أرقامها تتغير الآن: تحديث تلقائي). */
export function includesToday(range: DateRange, now = new Date()): boolean {
  const today = toIsoDay(now);
  return range.from <= today && today <= range.to;
}

/** مخصص صالح: من ≤ إلى، ولا يتجاوز سنة. يرجع نفس الفترة مصحّحة. */
export function clampCustom(from: Date, to: Date): DateRange {
  let a = from;
  let b = to;
  if (a > b) [a, b] = [b, a];
  if (rangeDays({ from: toIsoDay(a), to: toIsoDay(b) }) > MAX_RANGE_DAYS)
    a = addDays(b, -(MAX_RANGE_DAYS - 1));
  return { from: toIsoDay(a), to: toIsoDay(b) };
}

const shortDate = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
});
const weekday = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  weekday: "short",
});

export const formatShortDay = (iso: string) =>
  shortDate.format(parseIsoDay(iso));
export const formatWeekday = (iso: string) => weekday.format(parseIsoDay(iso));

/** «اليوم» / «أمس» / «9 نوفمبر» أو «9 – 15 نوفمبر». */
export function formatRange(range: DateRange, now = new Date()): string {
  const today = toIsoDay(now);
  const yesterday = toIsoDay(addDays(now, -1));
  if (range.from === range.to) {
    if (range.from === today) return "اليوم";
    if (range.from === yesterday) return "أمس";
    return formatShortDay(range.from);
  }
  return `${formatShortDay(range.from)} – ${formatShortDay(range.to)}`;
}
