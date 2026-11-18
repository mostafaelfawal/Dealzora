import type { OrderFilter, OrderStatus, StoreOrder } from "../types/store";

/** نفس قاعدة sync-server/app/services/store.py (SLUG_RE). */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;

export function slugError(slug: string): string | null {
  if (!slug) return "اكتب رابط المتجر";
  if (!SLUG_RE.test(slug))
    return "حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات فقط (3–40 حرفاً)";
  return null;
}

/** يحوّل ما يكتبه المالك لرابط صالح أثناء الكتابة: مسافات ← شرطة، وحروف صغيرة. */
export const toSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, 40);

export const ORDER_STATUS: Record<
  OrderStatus,
  { label: string; className: string; dot: string }
> = {
  new: {
    label: "جديد",
    className: "bg-primary text-primary-foreground",
    dot: "bg-primary",
  },
  confirmed: {
    label: "مؤكد",
    className: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  delivering: {
    label: "خرج للتوصيل",
    className: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  delivered: {
    label: "تم التسليم",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  cancelled: {
    label: "ملغي",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

/** الخطوة التالية للطلب (الزر الأساسي في البطاقة والتفاصيل). */
export const NEXT_STEP: Partial<
  Record<OrderStatus, { status: Exclude<OrderStatus, "new">; label: string }>
> = {
  new: { status: "confirmed", label: "تأكيد الطلب" },
  confirmed: { status: "delivering", label: "خرج للتوصيل" },
  delivering: { status: "delivered", label: "تم التسليم والتحصيل" },
};

export const isOpen = (s: OrderStatus) =>
  s === "new" || s === "confirmed" || s === "delivering";

export const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "open", label: "قيد التنفيذ" },
  { id: "new", label: "جديدة" },
  { id: "confirmed", label: "مؤكدة" },
  { id: "delivering", label: "في الطريق" },
  { id: "delivered", label: "مُسلَّمة" },
  { id: "cancelled", label: "ملغاة" },
  { id: "all", label: "الكل" },
];

export function filterCount(
  counts: Record<OrderStatus, number> | undefined,
  f: OrderFilter,
): number | undefined {
  if (!counts) return undefined;
  if (f === "all") return Object.values(counts).reduce((a, b) => a + b, 0);
  if (f === "open") return counts.new + counts.confirmed + counts.delivering;
  return counts[f];
}

/** أسباب جاهزة للإلغاء (تظهر للعميل في صفحة متابعة الطلب). */
export const CANCEL_REASONS = [
  "نفدت بعض الأصناف",
  "تعذّر الوصول للعميل",
  "العنوان خارج منطقة التوصيل",
  "طلب العميل الإلغاء",
] as const;

/** رقم هاتف للاتصال أو واتساب (مصر افتراضياً لو بدأ بصفر). */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function orderWhatsappText(o: StoreOrder, storeName: string): string {
  const status = ORDER_STATUS[o.status].label;
  return `مرحباً ${o.customerName}، بخصوص طلبك رقم #${o.number} من ${storeName}: حالة الطلب الآن «${status}».`;
}

export const formatQtyUnit = (qty: number, unit: string) =>
  `${Number.isInteger(qty) ? qty : qty.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${unit}`;
