import {
  earnedPoints,
  getLoyaltyConfig,
  maxRedeemable,
  redeemDiscount,
} from "@/lib/loyalty";
import { parseScaleBarcode, type ScaleBarcodeConfig } from "@/lib/scaleBarcode";
import { normalizeDigits } from "@/lib/format";
import type {
  CartLine,
  InvoiceDiscount,
  PosInvoice,
  PosProduct,
  PosUnit,
  StockLevel,
} from "../types/pos";

/** أقصى كمية للصنف في سطر واحد (حماية من غلطة كتابة). */
export const MAX_QTY = 9999;

export const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) =>
  Math.round((n + Number.EPSILON) * 1000) / 1000;

/** الأصناف بالقطعة أرقام صحيحة، والأصناف بالوزن لحد 3 كسور. */
export function clampQty(qty: number, allowDecimal: boolean) {
  if (!Number.isFinite(qty)) return allowDecimal ? 0.001 : 1;
  const bounded = Math.min(qty, MAX_QTY);
  return allowDecimal
    ? Math.max(round3(bounded), 0.001)
    : Math.max(Math.round(bounded), 1);
}

/* ---------- وحدات البيع ---------- */

/** مفتاح سطر الفاتورة: نفس الصنف بوحدتين مختلفتين = سطران. */
export const lineKey = (line: Pick<CartLine, "productId" | "unitId">) =>
  line.unitId ? `${line.productId}:${line.unitId}` : line.productId;

/** خيار وحدة للعرض والاختيار. id = null للوحدة الأساسية. */
export interface UnitOption {
  id: string | null;
  name: string;
  factor: number;
  price: number;
}

/** الوحدة الأساسية أولاً ثم الإضافية. */
export function unitOptions(product: PosProduct): UnitOption[] {
  return [
    { id: null, name: product.unit, factor: 1, price: product.price },
    ...(product.units ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      factor: u.factor,
      price: u.price,
    })),
  ];
}

/** الصنف (ووحدته لو الباركود لوحدة إضافية) المطابق للباركود تماماً. */
export function findByBarcode(
  products: PosProduct[],
  code: string,
): { product: PosProduct; unit: PosUnit | null } | null {
  for (const product of products) {
    if (product.barcode && product.barcode === code)
      return { product, unit: null };
    const unit = product.units?.find((u) => u.barcode && u.barcode === code);
    if (unit) return { product, unit };
  }
  return null;
}

/** ملصق ميزان ← الصنف والكمية (الوزن، أو قيمة الملصق ÷ سعر الكيلو). */
export function findByScaleBarcode(
  products: PosProduct[],
  code: string,
  cfg: ScaleBarcodeConfig,
): { product: PosProduct; qty: number; amount: number | null } | null {
  const read = parseScaleBarcode(code, cfg);
  if (!read) return null;
  const product = products.find((p) => p.scaleCode === read.scaleCode);
  if (!product) return null;
  const qty =
    read.weight ??
    (product.price > 0
      ? Math.round(((read.amount ?? 0) / product.price) * 1000) / 1000
      : 0);
  return qty > 0 ? { product, qty, amount: read.amount } : null;
}

export function getStockLevel(
  product: Pick<PosProduct, "stock" | "minStock">,
): StockLevel {
  if (product.stock <= 0) return "out";
  if (product.stock <= product.minStock) return "low";
  return "ok";
}

/** قيمة السطر قبل خصمه. */
export const lineGross = (line: CartLine) => round2(line.price * line.qty);

/** خصم العرض التلقائي على السطر (يحسبه pricing.ts). */
export const linePromo = (line: CartLine) =>
  round2(Math.min(Math.max(line.promo ?? 0, 0), lineGross(line)));

/** خصم الكاشير الفعلي (لا يتجاوز قيمة السطر بعد العرض). */
export const lineDiscount = (line: CartLine) =>
  round2(
    Math.min(
      Math.max(line.discount ?? 0, 0),
      lineGross(line) - linePromo(line),
    ),
  );

/** قيمة السطر بعد العرض والخصم. */
export const lineTotal = (line: CartLine) =>
  round2(lineGross(line) - linePromo(line) - lineDiscount(line));

export function calcDiscount(
  subtotal: number,
  discount: InvoiceDiscount | null,
) {
  if (!discount) return 0;
  const raw =
    discount.type === "percent"
      ? (subtotal * discount.value) / 100
      : discount.value;
  return round2(Math.min(Math.max(raw, 0), subtotal));
}

export interface InvoiceTotals {
  itemCount: number;
  qtyCount: number;
  /** مجموع العروض التلقائية. */
  promoDiscount: number;
  /** مجموع خصومات الأصناف. */
  linesDiscount: number;
  /** المجموع بعد خصم الأصناف (وقبل خصم الفاتورة). */
  subtotal: number;
  discountAmount: number;
  /** النقاط المستبدلة فعلاً (بعد القص للمسموح) وقيمة خصمها. */
  redeemPoints: number;
  loyaltyDiscount: number;
  /** تقدير النقاط التي سيكسبها العميل (السيرفر هو المرجع). */
  pointsToEarn: number;
  total: number;
}

export function calcTotals(invoice: PosInvoice): InvoiceTotals {
  const subtotal = round2(
    invoice.lines.reduce((sum, line) => sum + lineTotal(line), 0),
  );
  const discountAmount = calcDiscount(subtotal, invoice.discount);
  const loyalty = getLoyaltyConfig();
  const customer = invoice.customer;
  const base = round2(subtotal - discountAmount);
  const allowed = customer
    ? maxRedeemable(loyalty, customer.loyaltyPoints ?? 0, base)
    : 0;
  const wanted = invoice.redeemPoints ?? 0;
  const redeemPoints =
    Math.min(wanted - (wanted % loyalty.redeemPoints), allowed) || 0;
  const loyaltyDiscount = redeemDiscount(loyalty, redeemPoints);
  const total = round2(base - loyaltyDiscount);
  return {
    itemCount: invoice.lines.length,
    promoDiscount: round2(
      invoice.lines.reduce((sum, line) => sum + linePromo(line), 0),
    ),
    linesDiscount: round2(
      invoice.lines.reduce((sum, line) => sum + lineDiscount(line), 0),
    ),
    qtyCount: round3(invoice.lines.reduce((sum, l) => sum + l.qty, 0)),
    subtotal,
    discountAmount,
    redeemPoints,
    loyaltyDiscount,
    pointsToEarn: customer ? earnedPoints(loyalty, total) : 0,
    total,
  };
}

/* ---------- إدخال وبحث ---------- */

export function normalizeSearch(text: string) {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

/**
 * يفهم صيغة "3*باركود": الكمية قبل النجمة.
 * "3*" لوحدها = تعديل كمية الصنف المحدد.
 */
export function parseEntry(raw: string): { qty: number | null; term: string } {
  const text = normalizeDigits(raw).trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*\*\s*(.*)$/);
  if (!match) return { qty: null, term: text };
  return { qty: Number(match[1]), term: match[2].trim() };
}

export function searchProducts(
  products: PosProduct[],
  term: string,
  limit = 12,
): PosProduct[] {
  const query = normalizeSearch(term);
  if (!query) return [];
  const tokens = query.split(/\s+/);
  const digitsOnly = /^\d+$/.test(query);

  const scored: { product: PosProduct; score: number }[] = [];
  for (const product of products) {
    const name = normalizeSearch(product.name);
    let score = -1;
    const unitCodes = (product.units ?? []).map((u) => u.barcode);
    if (product.barcode === query || unitCodes.includes(query)) score = 0;
    else if (
      digitsOnly &&
      [product.barcode, ...unitCodes].some((c) => c && c.includes(query))
    )
      score = 1;
    else if (tokens.every((t) => name.includes(t)))
      score = name.startsWith(query) ? 2 : 3;
    if (score >= 0) scored.push({ product, score });
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score || a.product.name.localeCompare(b.product.name, "ar"),
    )
    .slice(0, limit)
    .map((s) => s.product);
}

/** فئات الكاش الشائعة اللي العميل غالباً هيدفعها (أكبر من الإجمالي). */
export function suggestCashAmounts(total: number, max = 3) {
  const result = new Set<number>();
  for (const d of [10, 20, 50, 100, 200, 500]) {
    result.add((Math.floor(total / d) + 1) * d);
  }
  return [...result].sort((a, b) => a - b).slice(0, max);
}
