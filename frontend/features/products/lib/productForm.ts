import type { ProductSchemaType } from "../schema/product.schema";
import type { Product } from "../types/product";

export const emptyValues = (): ProductSchemaType => ({
  name: "",
  barcode: "",
  category: "",
  unit: "قطعة",
  allowDecimal: false,
  costPrice: "",
  salePrice: "",
  minStock: "",
  scaleCode: "",
  wholesalePrice: "",
  wholesaleMinQty: "",
  openingStock: "",
  isActive: true,
  extraUnits: [],
});

export function toFormValues(product?: Product): ProductSchemaType {
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
    scaleCode: product.scaleCode === null ? "" : String(product.scaleCode),
    wholesalePrice:
      product.wholesalePrice === null ? "" : String(product.wholesalePrice),
    wholesaleMinQty:
      product.wholesaleMinQty === null ? "" : String(product.wholesaleMinQty),
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
