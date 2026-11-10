export interface MeasureUnit {
  id: string;
  name: string;
  /** الوحدة موزونة (كجم، لتر…): تفعّل "يُباع بالوزن" تلقائياً في فورم الصنف. */
  allowDecimal: boolean;
  /** عدد الأصناف التي تستخدمها (أساسية أو إضافية). */
  productCount: number;
  version: number;
}

export interface MeasureUnitDto {
  id: string;
  name: string;
  allow_decimal: boolean;
  product_count: number;
  version: number;
}

export type CatalogTab = "categories" | "units";
