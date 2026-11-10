/** تواريخ بيوم الجهاز المحلي (نفس منطق الـ backend: date.today()). */

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD محلي (لا نستخدم toISOString لأنه UTC). */
export const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = () => toIsoDay(new Date());

/** YYYY-MM-DD → منتصف الليل المحلي بالـ ms. */
export function parseIsoDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/* ---------- الفترات الجاهزة ---------- */

export type PeriodPreset =
  "today" | "yesterday" | "week" | "month" | "last_month" | "year" | "custom";

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
  last_month: "الشهر الماضي",
  year: "هذه السنة",
  custom: "فترة مخصصة",
};

export function presetRange(preset: PeriodPreset, now = new Date()): DateRange {
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
    case "last_month":
      return {
        from: toIsoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toIsoDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "year":
      return {
        from: toIsoDay(new Date(now.getFullYear(), 0, 1)),
        to: today,
      };
    default:
      return { from: today, to: today };
  }
}

/* ---------- العرض ---------- */

const dateFormat = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortDate = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
});
const dateTime = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const weekday = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  weekday: "short",
});

export const formatDate = (ts: number) => dateFormat.format(ts);
export const formatShortDate = (ts: number) => shortDate.format(ts);
export const formatDateTime = (ts: number) => dateTime.format(ts);
export const formatWeekday = (ts: number) => weekday.format(ts);

/** "اليوم" / "أمس" / تاريخ كامل. */
export function formatDayLabel(ts: number, now = new Date()) {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dayStart = new Date(ts);
  dayStart.setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday - dayStart.getTime()) / DAY_MS);
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  return formatDate(ts);
}

/** "اليوم 3:20 م" / "أمس 9:05 ص" / "12 نوفمبر 4:00 م". */
export function formatWhen(ts: number, now = new Date()) {
  const label = formatDayLabel(ts, now);
  const time = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ts);
  return label === "اليوم" || label === "أمس"
    ? `${label} ${time}`
    : formatDateTime(ts);
}
