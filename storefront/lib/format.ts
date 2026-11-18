const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const qtyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** قروش ← "1,250.5". العملة تُعرض بجانبه بخط أصغر (Price). */
export const formatAmount = (cents: number) => money.format(cents / 100);

export const formatMoney = (cents: number, currency: string) =>
  `${formatAmount(cents)} ${currency}`;

/** × 1000 ← "1.5". */
export const formatQty = (milli: number) => qtyFmt.format(milli / 1000);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

/** رابط واتساب برقم محلي مصري (يبدأ بصفر) أو دولي. */
export function waLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = phone.startsWith("+")
    ? digits
    : digits.startsWith("00")
      ? digits.slice(2)
      : digits.startsWith("0")
        ? `20${digits.slice(1)}`
        : digits;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** الأرقام العربية ← لاتينية (رقم الهاتف من الكيبورد العربي). */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}
