/**
 * تنسيق العرض فقط (المال يبقى بالقروش integer في كل مكان آخر).
 * نفس قواعد frontend/lib/format.ts: أرقام لاتينية وجمع عربي صحيح.
 * (حزمتان منفصلتان: Metro لا يقرأ من frontend، فالدوال الصغيرة منسوخة بنفس السلوك.)
 */

const dateTimeFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface ArabicCountForms {
  one: string;
  two: string;
  /** من 3 إلى 10. */
  few: string;
  /** من 11 فأكثر. */
  many: string;
}

/** "يوم" / "يومين" / "3 أيام" / "11 يومًا". */
export function formatArabicCount(count: number, forms: ArabicCountForms): string {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  return `${count} ${count <= 10 ? forms.few : forms.many}`;
}

export function formatDateTime(value: Date | string | number): string {
  return dateTimeFormatter.format(new Date(value));
}

/** "الآن" / "منذ دقيقتين" / "منذ 3 ساعات" / "منذ يومين"، وبعد أسبوع التاريخ نفسه. */
export function formatTimeAgo(from: Date | string | number, now: number = Date.now()): string {
  const ts = new Date(from).getTime();
  const minutes = Math.max(Math.floor((now - ts) / 60_000), 0);
  if (minutes < 1) return "الآن";
  if (minutes < 60) {
    return `منذ ${formatArabicCount(minutes, { one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة" })}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `منذ ${formatArabicCount(hours, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" })}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `منذ ${formatArabicCount(days, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" })}`;
  }
  return formatDateTime(ts);
}

/** قروش ← "1,250.00" (العرض فقط). */
export function formatPiastres(piastres: number): string {
  return moneyFormatter.format(piastres / 100);
}

/** عربي/فارسي ← لاتيني (المستخدم قد يكتب الكود بلوحة مفاتيح عربية). */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** كود ربط الهاتف: حروف كبيرة وأرقام لاتينية بشكل XXXX-XXXX-XXXX أثناء الكتابة. */
export function formatPairingCode(input: string): string {
  const raw = normalizeDigits(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return raw.match(/.{1,4}/g)?.join("-") ?? "";
}
