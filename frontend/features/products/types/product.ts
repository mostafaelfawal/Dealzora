export interface ProductUnit {
  id: string;
  name: string;
  factor: number;
  barcode: string;
  /** null = يُحسب من سعر الوحدة الأساسية. */
  salePrice: number | null;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  /** id القسم، وفارغ = بدون قسم. */
  category: string;
  categoryName: string | null;
  unit: string;
  allowDecimal: boolean;
  /** null = المستخدم لا يملك صلاحية رؤية سعر الشراء (الكاشير). */
  costPrice: number | null;
  salePrice: number;
  marginPercent: number | null;
  stock: number;
  minStock: number;
  isActive: boolean;
  /** نسخة السجل للتحكم في التعارض (base_version). */
  version: number;
  extraUnits: ProductUnit[];
}

export type StockFilter = "all" | "low" | "out";
/** نفس قيم الـ backend بالضبط. */
export type SortKey =
  | "name_asc"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "stock_asc"
  | "stock_desc"
  | "margin_desc";
export type ProductsView = "cards" | "table";

export interface ProductFilters {
  query: string;
  /** "all" أو id القسم. */
  category: string;
  stock: StockFilter;
  sort: SortKey;
  page: number;
  pageSize: number;
}

export interface ProductCategory {
  id: string;
  label: string;
}

export interface ProductsPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductsSummary {
  total: number;
  low: number;
  out: number;
  /** بالجنيه بسعر الشراء، وnull للكاشير. */
  stockValue: number | null;
}

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
