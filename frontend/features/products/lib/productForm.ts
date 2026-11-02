import type { Product, ProductFormValues } from "../types/product";
import { parseNumber } from "./productCalc";

export type FormField =
  | "name"
  | "barcode"
  | "costPrice"
  | "salePrice"
  | "minStock"
  | "openingStock"
  | "units";

export type FormErrors = Partial<Record<FormField, string>>;

/** ترتيب الحقول: أول خطأ بالترتيب ده هو اللي ياخد التركيز. */
export const FIELD_ORDER: FormField[] = [
  "name",
  "barcode",
  "costPrice",
  "salePrice",
  "units",
  "minStock",
  "openingStock",
];

export const emptyValues = (): ProductFormValues => ({
  name: "",
  barcode: "",
  category: "",
  unit: "قطعة",
  allowDecimal: false,
  costPrice: "",
  salePrice: "",
  minStock: "",
  openingStock: "",
  isActive: true,
  extraUnits: [],
});

export function toFormValues(product?: Product): ProductFormValues {
  if (!product) return emptyValues();
  return {
    name: product.name,
    barcode: product.barcode,
    category: product.category,
    unit: product.unit,
    allowDecimal: product.allowDecimal,
    costPrice: product.costPrice === null ? "" : String(product.costPrice),
    salePrice: String(product.salePrice),
    minStock: String(product.minStock),
    openingStock: "",
    isActive: product.isActive,
    extraUnits: product.extraUnits.map((u) => ({
      id: u.id,
      name: u.name,
      factor: String(u.factor),
      barcode: u.barcode,
      salePrice: u.salePrice === null ? "" : String(u.salePrice),
    })),
  };
}

/** فاضي = مقبول. غير فاضي لازم يكون رقماً ≥ 0. */
const isInvalidOptional = (text: string) =>
  text.trim() !== "" && !(parseNumber(text) >= 0);

export function validateProduct(values: ProductFormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.name.trim().length < 2)
    errors.name = "اكتب اسم الصنف (حرفين على الأقل).";

  if (isInvalidOptional(values.costPrice))
    errors.costPrice = "سعر الشراء يجب أن يكون رقماً صحيحاً.";

  if (!(parseNumber(values.salePrice) > 0))
    errors.salePrice = "أدخل سعر بيع أكبر من صفر.";

  if (isInvalidOptional(values.minStock))
    errors.minStock = "اكتب رقماً صحيحاً.";
  if (isInvalidOptional(values.openingStock))
    errors.openingStock = "اكتب رقماً صحيحاً.";

  const badUnit = values.extraUnits.some(
    (u) =>
      u.name.trim() === "" ||
      !(parseNumber(u.factor) > 1) ||
      !(parseNumber(u.salePrice) > 0),
  );
  if (badUnit)
    errors.units =
      "أكمل بيانات الوحدات الإضافية: الاسم، والعدد (أكبر من 1)، والسعر.";

  return errors;
}
