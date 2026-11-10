/** أرقام لاتينية (1,2,3) في كل التطبيق لسهولة القراءة والمقارنة. */
const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

const timeFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const CURRENCY_LABEL = "ج.م";

/* ---------- أرقام ومبالغ ---------- */

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** مبلغ كنص عادي (للـ toast والرسائل): "1,250.00 ج.م". في الواجهة استخدم <Money />. */
export function formatMoneyText(value: number): string {
  return `${formatNumber(value)} ${CURRENCY_LABEL}`;
}

/** كمية: أرقام صحيحة للقطعة، وحتى 3 كسور للوزن. */
export function formatQty(qty: number): string {
  return qtyFormatter.format(qty);
}

export function formatItemCount(count: number): string {
  return `${count} صنف`;
}

/* ---------- أرقام عربية/لاتينية ---------- */

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** لاتيني → عربي (للبحث برقم الجوال حتى لو اتكتب بالأرقام العربية). */
export function toArabicDigits(text: string): string {
  return text.replace(/\d/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/** عربي/فارسي → لاتيني، مع تحويل الفاصلة العشرية و× (الكيبورد العربي بيكتبها كده أحياناً). */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/×/g, "*");
}

/* ---------- جمع عربي ---------- */

interface ArabicCountForms {
  one: string;
  two: string;
  /** من 3 إلى 10. */
  few: string;
  /** من 11 فأكثر. */
  many: string;
}

/** "يوم" / "يومين" / "3 أيام" / "11 يومًا". */
export function formatArabicCount(
  count: number,
  forms: ArabicCountForms,
): string {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  return `${count} ${count <= 10 ? forms.few : forms.many}`;
}

export function formatDaysArabic(days: number): string {
  return formatArabicCount(days, {
    one: "يوم",
    two: "يومين",
    few: "أيام",
    many: "يومًا",
  });
}

/* ---------- وقت ---------- */

export function formatTime(value: Date | string | number): string {
  return timeFormatter.format(new Date(value));
}

/** صيغة مختصرة للـ Header: "قبل 5 د". */
export function formatMinutesAgo(from: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - from) / 60_000));

  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} د`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} س`;

  return `قبل ${Math.floor(hours / 24)} يوم`;
}

/** صيغة كاملة بقواعد الجمع العربية: "منذ دقيقتين". بعد 24 ساعة بترجّع الوقت نفسه. */
export function formatTimeAgo(from: number, now: number): string {
  const minutes = Math.max(Math.floor((now - from) / 60_000), 0);
  if (minutes < 1) return "الآن";

  if (minutes < 60) {
    return `منذ ${formatArabicCount(minutes, {
      one: "دقيقة",
      two: "دقيقتين",
      few: "دقائق",
      many: "دقيقة",
    })}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `منذ ${formatArabicCount(hours, {
      one: "ساعة",
      two: "ساعتين",
      few: "ساعات",
      many: "ساعة",
    })}`;
  }

  return formatTime(from);
}

/* ---------- إدخال أرقام ---------- */

/** نص من خانة رقمية (يقبل الأرقام العربية والفواصل) → رقم. NaN لو فاضي أو غير صالح. */
export function parseNumberInput(text: string): number {
  const cleaned = normalizeDigits(text).replace(/[,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

/** نفس parseNumberInput لكن الفاضي/غير الصالح = 0، ومقرّب لقرشين. */
export function moneyInputOrZero(text: string): number {
  const n = parseNumberInput(text);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}
