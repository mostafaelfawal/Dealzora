import { useSyncExternalStore } from "react";

/**
 * باركود الميزان للأصناف الموزونة. نفس منطق الـ backend (modules/settings/scale.py):
 *
 *   [بادئة][كود الصنف على الميزان][الوزن أو السعر][...][رقم التحقق]
 *    20      01234                  01250                 7   ← 1.250 كجم من الصنف 1234
 *
 * الإعداد يُحمَّل مع العملة (GET /settings)، والكاشير يقرأ الملصق من الكتالوج المحلي فوراً.
 */

export type ScaleMode = "weight" | "price";

export interface ScaleBarcodeConfig {
  enabled: boolean;
  /** بنفس الطول، 1 إلى 3 خانات (مثل 20..29). */
  prefixes: string[];
  codeLength: number;
  mode: ScaleMode;
  valueLength: number;
  /** الوزن: 3 = جرامات. السعر: 2 = قروش. */
  valueDecimals: number;
  checkDigit: boolean;
}

export const EAN13_LENGTH = 13;
export const SCALE_CODE_MAX = 999_999;

export const DEFAULT_SCALE_CONFIG: ScaleBarcodeConfig = {
  enabled: false,
  prefixes: ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"],
  codeLength: 5,
  mode: "weight",
  valueLength: 5,
  valueDecimals: 3,
  checkDigit: true,
};

export interface ScaleRead {
  scaleCode: number;
  /** الكمية (وضع الوزن). */
  weight: number | null;
  /** قيمة الملصق بالعملة (وضع السعر). */
  amount: number | null;
}

export function ean13Valid(code: string): boolean {
  if (code.length !== EAN13_LENGTH || !/^\d+$/.test(code)) return false;
  let total = 0;
  for (let i = 0; i < 12; i++) total += Number(code[i]) * (i % 2 ? 3 : 1);
  return (10 - (total % 10)) % 10 === Number(code[12]);
}

/** يكمل 12 رقماً برقم تحقق EAN-13 (لمعاينة الإعداد). */
export function withCheckDigit(body12: string): string {
  let total = 0;
  for (let i = 0; i < 12; i++) total += Number(body12[i]) * (i % 2 ? 3 : 1);
  return body12 + String((10 - (total % 10)) % 10);
}

/** null = ليس ملصق ميزان بهذه الصيغة (يُعامل كباركود عادي). */
export function parseScaleBarcode(
  code: string,
  cfg: ScaleBarcodeConfig,
): ScaleRead | null {
  if (!cfg.enabled || !cfg.prefixes.length) return null;
  if (code.length !== EAN13_LENGTH || !/^\d+$/.test(code)) return null;
  const plen = cfg.prefixes[0].length;
  if (!cfg.prefixes.includes(code.slice(0, plen))) return null;
  if (cfg.checkDigit && !ean13Valid(code)) return null;
  const start = plen + cfg.codeLength;
  const scaleCode = Number(code.slice(plen, start));
  const value = Number(code.slice(start, start + cfg.valueLength));
  if (!(scaleCode > 0) || !(value > 0)) return null;
  const real = value / 10 ** cfg.valueDecimals;
  return cfg.mode === "weight"
    ? { scaleCode, weight: real, amount: null }
    : { scaleCode, weight: null, amount: real };
}

/** سبب رفض الإعداد، أو null (نفس قواعد الـ backend). */
export function scaleConfigError(cfg: ScaleBarcodeConfig): string | null {
  if (!cfg.prefixes.length) return "أدخل بادئة واحدة على الأقل (مثل 20)";
  if (cfg.prefixes.some((p) => !/^\d{1,3}$/.test(p)))
    return "البادئة أرقام فقط من 1 إلى 3 خانات";
  if (new Set(cfg.prefixes.map((p) => p.length)).size !== 1)
    return "كل البادئات يجب أن تكون بنفس الطول";
  const used = cfg.prefixes[0].length + cfg.codeLength + cfg.valueLength;
  if (used > EAN13_LENGTH - 1)
    return `البادئة + الكود + القيمة = ${used} خانة، والحد 12 (الخانة 13 للتحقق)`;
  if (cfg.mode === "price" && cfg.valueDecimals > 2)
    return "السعر لا يقبل أكثر من خانتين عشريتين";
  return null;
}

/** «20,21» أو «20-29» أو «20 21» ← ["20","21",...]. */
export function parsePrefixes(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[\s,،]+/).filter(Boolean)) {
    const range = /^(\d{1,3})-(\d{1,3})$/.exec(part);
    if (range && range[1].length === range[2].length) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      for (let n = Math.min(a, b); n <= Math.max(a, b) && out.length < 10; n++)
        out.push(String(n).padStart(range[1].length, "0"));
    } else out.push(part);
  }
  return [...new Set(out)];
}

/** للعرض: ["20".."29"] ← «20-29». */
export function formatPrefixes(prefixes: string[]): string {
  const nums = prefixes.map(Number);
  const consecutive =
    prefixes.length > 2 &&
    new Set(prefixes.map((p) => p.length)).size === 1 &&
    nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  return consecutive
    ? `${prefixes[0]}-${prefixes[prefixes.length - 1]}`
    : prefixes.join(", ");
}

// ---------- مخزن الإعداد (يُحدَّث من GET /settings) ----------
let current: ScaleBarcodeConfig = DEFAULT_SCALE_CONFIG;
const listeners = new Set<() => void>();

export const getScaleConfig = () => current;

export function setScaleConfig(next: ScaleBarcodeConfig) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((fn) => fn());
}

export function useScaleConfig(): ScaleBarcodeConfig {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getScaleConfig,
    () => DEFAULT_SCALE_CONFIG,
  );
}

// ---------- تحويل شكل الـ backend ----------
export interface ScaleBarcodeDto {
  enabled: boolean;
  prefixes: string[];
  code_length: number;
  mode: ScaleMode;
  value_length: number;
  value_decimals: number;
  check_digit: boolean;
}

export const fromScaleDto = (
  d: ScaleBarcodeDto | undefined,
): ScaleBarcodeConfig =>
  d
    ? {
        enabled: d.enabled,
        prefixes: d.prefixes,
        codeLength: d.code_length,
        mode: d.mode,
        valueLength: d.value_length,
        valueDecimals: d.value_decimals,
        checkDigit: d.check_digit,
      }
    : DEFAULT_SCALE_CONFIG;

export const toScaleDto = (c: ScaleBarcodeConfig): ScaleBarcodeDto => ({
  enabled: c.enabled,
  prefixes: c.prefixes,
  code_length: c.codeLength,
  mode: c.mode,
  value_length: c.valueLength,
  value_decimals: c.valueDecimals,
  check_digit: c.checkDigit,
});
