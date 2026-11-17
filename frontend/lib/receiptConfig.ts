import { useSyncExternalStore } from "react";

/**
 * شكل الفاتورة المطبوعة (للمحل كله، من القاعدة: GET /settings → receipt).
 * يُحمَّل مع العملة عند فتح البرنامج، ويُقرأ خارج React وقت الطباعة (getReceiptConfig).
 * الافتراضي = شكل الإيصال قبل إضافة الإعداد تماماً.
 */
export type ReceiptFontSize = "small" | "normal" | "large";

export interface ReceiptConfig {
  /** data:image/... أو null. */
  logo: string | null;
  showLogo: boolean;
  address: string;
  phone: string;
  taxNumber: string;
  headerNote: string;
  showCashier: boolean;
  showCustomer: boolean;
  showPaymentDetails: boolean;
  /** باركود خطي برقم الفاتورة (يُمسح في البحث). */
  showBarcode: boolean;
  /** الإيصال الحراري المختصر (يوفّر الورق). */
  compact: boolean;
  footer: string;
  /** شروط الاستبدال (A4 فقط). */
  terms: string;
  fontSize: ReceiptFontSize;
  /** لون فاتورة A4 (#rrggbb). */
  accent: string;
}

export const DEFAULT_RECEIPT: ReceiptConfig = {
  logo: null,
  showLogo: true,
  address: "",
  phone: "",
  taxNumber: "",
  headerNote: "",
  showCashier: true,
  showCustomer: true,
  showPaymentDetails: true,
  showBarcode: true,
  compact: true,
  footer: "شكراً لزيارتكم",
  terms: "",
  fontSize: "normal",
  accent: "#1f2937",
};

export const RECEIPT_LIMITS = {
  address: 160,
  phone: 60,
  taxNumber: 40,
  headerNote: 160,
  footer: 300,
  terms: 800,
} as const;

/** ألوان جاهزة لفاتورة A4 (التاجر يختار ولا يكتب كود لون). */
export const ACCENT_COLORS: { value: string; label: string }[] = [
  { value: "#1f2937", label: "رمادي داكن" },
  { value: "#1d4ed8", label: "أزرق" },
  { value: "#047857", label: "أخضر" },
  { value: "#b91c1c", label: "أحمر" },
  { value: "#7c3aed", label: "بنفسجي" },
  { value: "#c2410c", label: "برتقالي" },
];

let current: ReceiptConfig = DEFAULT_RECEIPT;
const listeners = new Set<() => void>();

export const getReceiptConfig = () => current;

export function setReceiptConfig(next: ReceiptConfig) {
  current = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useReceiptConfig(): ReceiptConfig {
  return useSyncExternalStore(
    subscribe,
    getReceiptConfig,
    () => DEFAULT_RECEIPT,
  );
}

/* ---------- DTO ---------- */

export interface ReceiptDto {
  logo: string | null;
  show_logo: boolean;
  address: string;
  phone: string;
  tax_number: string;
  header_note: string;
  show_cashier: boolean;
  show_customer: boolean;
  show_payment_details: boolean;
  show_barcode?: boolean;
  compact?: boolean;
  footer: string;
  terms: string;
  font_size: ReceiptFontSize;
  accent: string;
}

export const fromReceiptDto = (d: ReceiptDto | undefined): ReceiptConfig =>
  d
    ? {
        logo: d.logo,
        showLogo: d.show_logo,
        address: d.address,
        phone: d.phone,
        taxNumber: d.tax_number,
        headerNote: d.header_note,
        showCashier: d.show_cashier,
        showCustomer: d.show_customer,
        showPaymentDetails: d.show_payment_details,
        showBarcode: d.show_barcode ?? true,
        compact: d.compact ?? true,
        footer: d.footer,
        terms: d.terms,
        fontSize: d.font_size,
        accent: d.accent,
      }
    : DEFAULT_RECEIPT;

export const toReceiptDto = (c: ReceiptConfig): ReceiptDto => ({
  logo: c.logo,
  show_logo: c.showLogo,
  address: c.address,
  phone: c.phone,
  tax_number: c.taxNumber,
  header_note: c.headerNote,
  show_cashier: c.showCashier,
  show_customer: c.showCustomer,
  show_payment_details: c.showPaymentDetails,
  show_barcode: c.showBarcode,
  compact: c.compact,
  footer: c.footer,
  terms: c.terms,
  font_size: c.fontSize,
  accent: c.accent,
});

/** أقصى أبعاد الشعار بعد التصغير (يكفي للحراري وA4، وحجمه صغير في القاعدة). */
const LOGO_MAX_PX = 360;
/** نفس حد الـ backend (MAX_LOGO_CHARS في receipt.py). */
const MAX_LOGO_CHARS = 240_000;

/**
 * يقرأ صورة الشعار ويصغّرها ويحوّلها لـ PNG مضمّن (خلفية بيضاء: الطابعة الحرارية لا تفهم الشفافية).
 */
export async function logoFromFile(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type))
    throw new Error("اختر صورة PNG أو JPG");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("الصورة كبيرة جداً (أقصى حد 8 ميجا)");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, LOGO_MAX_PX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر قراءة الصورة");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // الشعارات (ألوان قليلة) صغيرة كـ PNG؛ الصور الفوتوغرافية أصغر بكثير كـ JPG.
    const png = canvas.toDataURL("image/png");
    if (png.length <= MAX_LOGO_CHARS) return png;
    const jpg = canvas.toDataURL("image/jpeg", 0.85);
    if (jpg.length <= MAX_LOGO_CHARS) return jpg;
    throw new Error("تعذّر تصغير الصورة بما يكفي، جرّب شعاراً أبسط");
  } finally {
    URL.revokeObjectURL(url);
  }
}
