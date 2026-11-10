/**
 * تحويلات مشتركة بين شكل الـ backend والواجهة.
 * الـ backend: المال بالقروش، الكميات × 1000، التواريخ ISO (أحياناً بدون منطقة زمنية).
 */

export const MONEY_SCALE = 100;
export const QTY_SCALE = 1000;

/** قروش → جنيه. */
export const toPounds = (cents: number) => cents / MONEY_SCALE;
/** جنيه → قروش (تقريب لأقرب قرش). */
export const toCents = (pounds: number) => Math.round(pounds * MONEY_SCALE);

/** كمية × 1000 → كمية عادية. */
export const fromQty = (scaled: number) => scaled / QTY_SCALE;
/** كمية عادية → × 1000. */
export const toQty = (qty: number) => Math.round(qty * QTY_SCALE);

/** قيمة اختيارية (الكاشير يستلم null للتكلفة والربح). */
export const toPoundsOrNull = (cents: number | null) =>
  cents === null ? null : toPounds(cents);

/** SQLite يرجّع datetime بدون منطقة زمنية (UTC)، فنضيف Z عند غيابها. */
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/i;
export const toMs = (iso: string): number =>
  Date.parse(HAS_TZ.test(iso) ? iso : `${iso}Z`);

export const toMsOrNull = (iso: string | null) =>
  iso === null ? null : toMs(iso);

/** يحذف القيم الفارغة من params قبل إرسالها (undefined / "" / "all"). */
export function cleanParams<T extends Record<string, unknown>>(
  params: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && v !== "all",
    ),
  ) as Partial<T>;
}

/** مفتاح فريد لكل عملية حفظ (يمنع تكرار الفاتورة لو اتبعتت مرتين). */
export function newClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}
