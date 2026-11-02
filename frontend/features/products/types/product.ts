/** وحدة بيع إضافية للصنف (كرتونة، دستة...). المخزون يُحسب دائماً بالوحدة الأساسية. */
export interface ProductUnit {
  id: string;
  name: string;
  /** كم وحدة أساسية داخل هذه الوحدة (كرتونة = 12 قطعة). */
  factor: number;
  barcode: string;
  salePrice: number;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  /** id القسم، وفارغ = بدون قسم. */
  category: string;
  /** الوحدة الأساسية (قطعة، كجم...). */
  unit: string;
  /** true للأصناف اللي بتتباع بكسور (وزن/طول). */
  allowDecimal: boolean;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  extraUnits: ProductUnit[];
}

export type StockFilter = "all" | "low" | "out";
export type SortKey = "name" | "price" | "stock" | "margin";
export type ProductsView = "cards" | "table";

export interface ProductFilters {
  query: string;
  category: string;
  stock: StockFilter;
  sort: SortKey;
}

/** صف وحدة إضافية داخل الفورم (كل القيم نصوص لحد ما نتحقق منها). */
export interface UnitFormRow {
  id: string;
  name: string;
  factor: string;
  barcode: string;
  salePrice: string;
}

/** قيم الفورم نصوص عمداً، فالمستخدم يقدر يكتب بحرية والتحقق بيحصل لاحقاً. */
export interface ProductFormValues {
  name: string;
  barcode: string;
  category: string;
  unit: string;
  allowDecimal: boolean;
  costPrice: string;
  salePrice: string;
  minStock: string;
  /** رصيد افتتاحي (عند الإضافة فقط). */
  openingStock: string;
  isActive: boolean;
  extraUnits: UnitFormRow[];
}
