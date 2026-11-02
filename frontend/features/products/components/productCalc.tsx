import { normalizeDigits } from "@/lib/format";
import { round2 } from "@/features/pos/lib/posCalc";

/** يقبل الأرقام العربية والفاصلة. بيرجّع NaN لو فاضي أو غير صالح. */
export function parseNumber(text: string): number {
  const cleaned = normalizeDigits(text).replace(/[,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

export const numberOrZero = (value: number) =>
  Number.isFinite(value) ? value : 0;

export interface Margin {
  /** ربح الوحدة بالجنيه. */
  profit: number;
  /** هامش الربح من سعر البيع (%). */
  percent: number;
}

export function calcMargin(cost: number, sale: number): Margin | null {
  if (!(sale > 0)) return null;
  const profit = round2(sale - cost);
  return { profit, percent: Math.round((profit / sale) * 100) };
}

/** سعر البيع المقترح: التكلفة + نسبة، مقرّب لأعلى لأقرب نصف جنيه. */
export function suggestSalePrice(cost: number, markupPercent: number) {
  return Math.ceil(cost * (1 + markupPercent / 100) * 2) / 2;
}

/** باركود EAN-13 داخلي (بادئة 622 = مصر) مع رقم تحقق صحيح. */
export function generateBarcode(): string {
  let body = "622";
  for (let i = 0; i < 9; i++) body += Math.floor(Math.random() * 10);
  const sum = [...body].reduce(
    (total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3),
    0,
  );
  return body + ((10 - (sum % 10)) % 10);
}

export const newLocalId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** نسبة شريط المخزون (الحد الأدنى = ثلث الشريط تقريباً). */
export function stockRatio(stock: number, minStock: number) {
  if (stock <= 0) return 0;
  const full = Math.max(minStock * 3, 1);
  return Math.min(stock / full, 1);
}
