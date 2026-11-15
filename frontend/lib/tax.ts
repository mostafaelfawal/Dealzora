import { useSyncExternalStore } from "react";

/**
 * ضريبة القيمة المضافة. نفس حساب الـ backend حرفياً (modules/tax/calc.py) بالقروش وأعداد صحيحة،
 * والسيرفر هو المرجع. الترتيب: قيمة السطر بعد العرض وخصم السطر ← توزيع خصم الفاتورة + الولاء
 * على السطور ← الضريبة لكل سطر وتُقرَّب (نصف القرش لأعلى) ← الفاتورة = مجموع السطور.
 *
 * الإعداد يُحمَّل مع العملة (GET /settings). النسب في الواجهة بالمئة (14)، وفي الـ backend
 * بنقاط الأساس (1400).
 */

export type TaxType = "taxable" | "exempt" | "zero";
export type TaxMode = "off" | "inclusive" | "exclusive";

export const TAX_TYPES: TaxType[] = ["taxable", "exempt", "zero"];

export const TAX_TYPE_LABEL: Record<TaxType, string> = {
  taxable: "خاضع للضريبة",
  exempt: "معفى",
  zero: "نسبة صفر",
};

export interface TaxConfig {
  /** المحل مسجل في ضريبة القيمة المضافة. */
  enabled: boolean;
  /** أسعار البيع شاملة الضريبة. */
  pricesIncludeTax: boolean;
  /** النسبة الافتراضية للأصناف الجديدة (بالمئة). */
  defaultRate: number;
}

export const DEFAULT_TAX: TaxConfig = {
  enabled: false,
  pricesIncludeTax: true,
  defaultRate: 14,
};

/** 100% بنقاط الأساس. */
const RATE_SCALE = 10_000;

/** بالمئة ← نقاط أساس (14 → 1400). */
export const toBasisPoints = (percent: number) => Math.round(percent * 100);
/** نقاط أساس ← بالمئة (1400 → 14). */
export const fromBasisPoints = (bp: number) => bp / 100;

export const taxMode = (cfg: TaxConfig): TaxMode =>
  !cfg.enabled ? "off" : cfg.pricesIncludeTax ? "inclusive" : "exclusive";

/* ---------- الحساب (قروش، أعداد صحيحة) ---------- */

/** قسمة صحيحة بتقريب النصف لأعلى (مثل round_div في الـ backend). BigInt حتى لا يفقد الدقة. */
function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) return BigInt(0);
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}

/** توزيع خصم الفاتورة على السطور بنسبة قيمتها، والباقي على آخر سطر يتحمله (مثل allocate). */
export function allocate(totalDiscount: number, amounts: number[]): number[] {
  const base = amounts.reduce((s, a) => s + a, 0);
  if (base <= 0 || totalDiscount <= 0) return [...amounts];
  const shares = amounts.map((a) =>
    Number((BigInt(totalDiscount) * BigInt(a)) / BigInt(base)),
  );
  const remainder = totalDiscount - shares.reduce((s, x) => s + x, 0);
  for (let i = amounts.length - 1; i >= 0; i--) {
    if (amounts[i] - shares[i] >= remainder) {
      shares[i] += remainder;
      break;
    }
  }
  return amounts.map((a, i) => a - shares[i]);
}

export interface TaxLineIn {
  /** قيمة السطر بعد العرض وخصم السطر (قروش). */
  amount: number;
  taxType: TaxType;
  /** نسبة الصنف بنقاط الأساس. */
  rate: number;
}

export interface TaxLineOut {
  rate: number;
  net: number;
  taxable: number;
  tax: number;
  total: number;
}

export interface InvoiceTax {
  mode: TaxMode;
  lines: TaxLineOut[];
  taxable: number;
  tax: number;
  total: number;
}

export function appliedRate(mode: TaxMode, type: TaxType, rate: number) {
  return mode === "off" || type !== "taxable" ? 0 : Math.max(rate, 0);
}

/** [الوعاء، الضريبة، الإجمالي] لصافي سطر. */
export function splitLine(
  net: number,
  rate: number,
  mode: TaxMode,
): [number, number, number] {
  if (rate <= 0 || net <= 0) return [net, 0, net];
  if (mode === "inclusive") {
    const tax = Number(
      roundDiv(BigInt(net) * BigInt(rate), BigInt(RATE_SCALE + rate)),
    );
    return [net - tax, tax, net];
  }
  const tax = Number(roundDiv(BigInt(net) * BigInt(rate), BigInt(RATE_SCALE)));
  return [net, tax, net + tax];
}

/** discount = خصم الفاتورة + خصم الولاء بالقروش. */
export function computeInvoiceTax(
  lines: TaxLineIn[],
  discount: number,
  mode: TaxMode,
): InvoiceTax {
  const nets = allocate(
    discount,
    lines.map((l) => l.amount),
  );
  const out = lines.map((line, i) => {
    const rate = appliedRate(mode, line.taxType, line.rate);
    const [taxable, tax, total] = splitLine(nets[i], rate, mode);
    return { rate, net: nets[i], taxable, tax, total };
  });
  return {
    mode,
    lines: out,
    taxable: out.reduce((s, l) => s + l.taxable, 0),
    tax: out.reduce((s, l) => s + l.tax, 0),
    total: out.reduce((s, l) => s + l.total, 0),
  };
}

/** «14%» أو «2.5%» للعرض. */
export const formatRate = (percent: number) =>
  `${Math.round(percent * 100) / 100}%`;

// ---------- مخزن الإعداد ----------
let current: TaxConfig = DEFAULT_TAX;
const listeners = new Set<() => void>();

export const getTaxConfig = () => current;

export function setTaxConfig(next: TaxConfig) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((fn) => fn());
}

export function useTaxConfig(): TaxConfig {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getTaxConfig,
    () => DEFAULT_TAX,
  );
}

// ---------- شكل الـ backend (نقاط أساس) ----------
export interface TaxDto {
  enabled: boolean;
  prices_include_tax: boolean;
  default_rate: number;
}

export const fromTaxDto = (d: TaxDto | undefined): TaxConfig =>
  d
    ? {
        enabled: d.enabled,
        pricesIncludeTax: d.prices_include_tax,
        defaultRate: fromBasisPoints(d.default_rate),
      }
    : DEFAULT_TAX;

export const toTaxDto = (c: TaxConfig): TaxDto => ({
  enabled: c.enabled,
  prices_include_tax: c.pricesIncludeTax,
  default_rate: toBasisPoints(c.defaultRate),
});
