import { z } from "zod";

import { normalizeDigits } from "@/lib/format";

import {
  BACKEND_DECIMAL_UNITS,
  BARCODE_PATTERN,
  MAX_MONEY,
  MAX_NAME_LEN,
  MAX_QTY,
  MAX_UNIT_NAME_LEN,
} from "../config/productLimits";
import { MAX_EXTRA_UNITS } from "../config/productOptions";
import { parseNumber } from "../lib/productCalc";
import { MONEY_SCALE, QTY_SCALE } from "../lib/productMapper";
import { currencyName } from "@/lib/currency";

const EPSILON = 1e-6;

const format = (value: number) => value.toLocaleString("en-US");
const isBlank = (text: string) => text.trim() === "";
const cleanText = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");
const length = (text: string) => [...text].length;

function toScaled(text: string, scale: number): number | null {
  const value = parseNumber(text);
  if (!Number.isFinite(value)) return null;
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > EPSILON) return null;
  return rounded;
}

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

function nameError(text: string) {
  const value = cleanText(text);
  if (!value) return "اسم الصنف مطلوب";
  if (length(value) > MAX_NAME_LEN)
    return `اسم الصنف أطول من ${MAX_NAME_LEN} حرفاً`;
  return null;
}

function unitNameError(text: string) {
  const value = cleanText(text);
  if (!value) return "اسم الوحدة مطلوب";
  if (length(value) > MAX_UNIT_NAME_LEN)
    return `اسم الوحدة أطول من ${MAX_UNIT_NAME_LEN} حرفاً`;
  return null;
}

function barcodeError(text: string) {
  if (isBlank(text)) return null;
  if (!BARCODE_PATTERN.test(normalizeDigits(text).trim()))
    return "الباركود غير صالح (أرقام أو حروف إنجليزية، من 3 إلى 32 خانة)";
  return null;
}

function scaleCodeError(text: string) {
  if (isBlank(text)) return null;
  const value = normalizeDigits(text).trim();
  if (!/^\d{1,6}$/.test(value) || Number(value) < 1)
    return "كود الميزان رقم من 1 إلى 999999";
  return null;
}

function costError(text: string) {
  if (isBlank(text)) return null;
  const scaled = toScaled(text, MONEY_SCALE);
  if (scaled === null || scaled < 0)
    return "سعر الشراء يجب أن يكون رقماً صحيحاً (حتى خانتين عشريتين).";
  if (scaled > MAX_MONEY)
    return `سعر الشراء لا يتجاوز ${format(MAX_MONEY / MONEY_SCALE)} ${currencyName()}.`;
  return null;
}

function saleError(text: string) {
  const scaled = toScaled(text, MONEY_SCALE);
  if (scaled === null || scaled <= 0) return "أدخل سعر بيع أكبر من صفر.";
  if (scaled > MAX_MONEY)
    return `سعر البيع لا يتجاوز ${format(MAX_MONEY / MONEY_SCALE)} ${currencyName()}.`;
  return null;
}

function unitSaleError(text: string) {
  if (isBlank(text)) return null;
  const scaled = toScaled(text, MONEY_SCALE);
  if (scaled === null || scaled < 0)
    return "سعر الوحدة يجب أن يكون رقماً صحيحاً (حتى خانتين عشريتين).";
  if (scaled > MAX_MONEY)
    return `سعر الوحدة لا يتجاوز ${format(MAX_MONEY / MONEY_SCALE)} ${currencyName()}.`;
  return null;
}

function qtyError(text: string) {
  if (isBlank(text)) return null;
  const scaled = toScaled(text, QTY_SCALE);
  if (scaled === null || scaled < 0)
    return "اكتب رقماً صحيحاً (حتى 3 خانات عشرية).";
  if (scaled > MAX_QTY)
    return `القيمة لا تتجاوز ${format(MAX_QTY / QTY_SCALE)}.`;
  return null;
}

function factorError(text: string) {
  if (isBlank(text)) return "اكتب عدد الوحدات الأساسية.";
  const scaled = toScaled(text, QTY_SCALE);
  if (scaled === null) return "اكتب رقماً صحيحاً (حتى 3 خانات عشرية).";
  if (scaled < QTY_SCALE) return "العدد يجب أن يكون 1 أو أكثر.";
  if (scaled > MAX_QTY)
    return `القيمة لا تتجاوز ${format(MAX_QTY / QTY_SCALE)}.`;
  return null;
}

export const unitSchema = z.object({
  id: z.string(),
  name: check(unitNameError),
  factor: check(factorError),
  barcode: check(barcodeError),
  salePrice: check(unitSaleError),
});

export const productSchema = z
  .object({
    name: check(nameError),
    barcode: check(barcodeError),
    category: z.string(),
    unit: check(unitNameError),
    allowDecimal: z.boolean(),
    costPrice: check(costError),
    salePrice: check(saleError),
    minStock: check(qtyError),
    scaleCode: check(scaleCodeError),
    wholesalePrice: check(costError),
    wholesaleMinQty: check(qtyError),
    openingStock: check(qtyError),
    isActive: z.boolean(),
    extraUnits: z
      .array(unitSchema)
      .max(MAX_EXTRA_UNITS, `الحد الأقصى ${MAX_EXTRA_UNITS} وحدات إضافية`),
  })
  .superRefine((values, ctx) => {
    const baseUnit = cleanText(values.unit);
    const decimal = values.allowDecimal || BACKEND_DECIMAL_UNITS.has(baseUnit);

    if (!decimal) {
      const quantities = [
        ["minStock", "الحد الأدنى"],
        ["openingStock", "الرصيد الافتتاحي"],
      ] as const;
      for (const [key, label] of quantities) {
        const scaled = toScaled(values[key], QTY_SCALE);
        if (scaled !== null && scaled % QTY_SCALE !== 0) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${label} لا يقبل كسوراً لأن الصنف لا يُباع بالوزن`,
          });
        }
      }
    }

    if (values.wholesalePrice.trim()) {
      const wholesale = toScaled(values.wholesalePrice, MONEY_SCALE);
      const retail = toScaled(values.salePrice, MONEY_SCALE);
      if (wholesale !== null && retail !== null && wholesale >= retail) {
        ctx.addIssue({
          code: "custom",
          path: ["wholesalePrice"],
          message: "سعر الجملة يجب أن يكون أقل من سعر البيع",
        });
      }
    }

    const names = new Set<string>([baseUnit]);
    const barcodes = new Set<string>();
    const mainBarcode = normalizeDigits(values.barcode).trim();
    if (mainBarcode) barcodes.add(mainBarcode);

    values.extraUnits.forEach((unit, index) => {
      const name = cleanText(unit.name);
      if (name) {
        if (names.has(name)) {
          ctx.addIssue({
            code: "custom",
            path: ["extraUnits", index, "name"],
            message: `اسم الوحدة «${name}» مكرر`,
          });
        }
        names.add(name);
      }

      const barcode = normalizeDigits(unit.barcode).trim();
      if (barcode) {
        if (barcodes.has(barcode)) {
          ctx.addIssue({
            code: "custom",
            path: ["extraUnits", index, "barcode"],
            message: `الباركود ${barcode} مكرر داخل نفس الصنف`,
          });
        }
        barcodes.add(barcode);
      }
    });
  });

export type ProductSchemaType = z.infer<typeof productSchema>;
export type UnitSchemaType = z.infer<typeof unitSchema>;
