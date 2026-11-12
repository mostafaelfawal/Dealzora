import type { UnitSchemaType } from "../schema/product.schema";

/** معرّفات حقول نموذج الصنف (تُستخدم للتركيز وربط رسائل الخطأ). */
export const PRODUCT_FIELD_IDS = {
  name: "pf-name",
  barcode: "pf-barcode",
  category: "pf-category",
  unit: "pf-unit",
  allowDecimal: "pf-decimal",
  costPrice: "pf-cost",
  salePrice: "pf-sale",
  minStock: "pf-min",
  scaleCode: "pf-scale",
  openingStock: "pf-opening",
  extraUnits: "pf-units",
  isActive: "pf-active",
} as const;

export type UnitKey = Exclude<keyof UnitSchemaType, "id">;
export const UNIT_KEYS: UnitKey[] = ["name", "factor", "barcode", "salePrice"];

export const unitFieldId = (key: UnitKey, index: number) =>
  `pf-unit-${key}-${index}`;

/** ترتيب الحقول على الشاشة: أول خطأ بهذا الترتيب يأخذ التركيز. */
export const PRODUCT_ERROR_ORDER = [
  "name",
  "barcode",
  "scaleCode",
  "costPrice",
  "salePrice",
  "extraUnits",
  "minStock",
  "openingStock",
] as const;

export const NO_CATEGORY = "none";
