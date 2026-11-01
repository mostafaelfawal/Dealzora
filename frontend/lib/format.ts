/** أرقام لاتينية (1,2,3) في كل التطبيق لسهولة القراءة والمقارنة. */
const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const CURRENCY_LABEL = "ج.م";

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatTime(value: Date | string | number): string {
  return timeFormatter.format(new Date(value));
}

export function formatMinutesAgo(from: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - from) / 60_000));

  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} د`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} س`;

  return `قبل ${Math.floor(hours / 24)} يوم`;
}

export function formatDaysArabic(days: number): string {
  if (days === 1) return "يوم";
  if (days === 2) return "يومين";
  return `${days} أيام`;
}
