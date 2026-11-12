import type { ProductSchemaType } from "../schema/product.schema";
import type {
  ProductCreatePayload,
  ProductUpdatePayload,
} from "../types/productApi";
import { normalizeDigits } from "@/lib/format";

import { parseNumber } from "./productCalc";
import { MONEY_SCALE, QTY_SCALE } from "./productMapper";

/** نص → رقم صحيح بعد الضرب في المقياس. الفارغ = 0. (التحقق تم في الـ schema) */
const scaled = (text: string, scale: number) => {
  const value = parseNumber(text);
  return Number.isFinite(value) ? Math.round(value * scale) : 0;
};

const orNull = (text: string) => text.trim() || null;

function toBase(v: ProductSchemaType) {
  return {
    name: v.name.trim(),
    barcode: orNull(v.barcode),
    category_id: orNull(v.category),
    unit: v.unit.trim(),
    allow_decimal: v.allowDecimal,
    cost_price: scaled(v.costPrice, MONEY_SCALE),
    sale_price: scaled(v.salePrice, MONEY_SCALE),
    min_stock: scaled(v.minStock, QTY_SCALE),
    // كود الميزان للأصناف الموزونة فقط: يُمسح لو أُلغي «يُباع بالوزن».
    scale_code:
      v.allowDecimal && v.scaleCode.trim()
        ? Number(normalizeDigits(v.scaleCode).trim())
        : null,
    is_active: v.isActive,
    extra_units: v.extraUnits.map((u) => ({
      id: u.id,
      name: u.name.trim(),
      factor: scaled(u.factor, QTY_SCALE),
      barcode: orNull(u.barcode),
      sale_price: u.salePrice.trim() ? scaled(u.salePrice, MONEY_SCALE) : null,
    })),
  };
}

export const toCreatePayload = (
  v: ProductSchemaType,
): ProductCreatePayload => ({
  ...toBase(v),
  opening_stock: scaled(v.openingStock, QTY_SCALE),
});

export const toUpdatePayload = (
  v: ProductSchemaType,
  baseVersion: number,
): ProductUpdatePayload => ({ ...toBase(v), base_version: baseVersion });
