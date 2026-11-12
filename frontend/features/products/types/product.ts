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
  /** كود الصنف على الميزان (PLU). null = لا يُوزن على الميزان. */
  scaleCode: number | null;
  /** سعر الجملة للوحدة الأساسية (null = لا يوجد). */
  wholesalePrice: number | null;
  /** الكمية التي يبدأ منها سعر الجملة (null = لعملاء الجملة فقط). */
  wholesaleMinQty: number | null;
  /** تتبع الصلاحية والدفعات (خطة سلسلة). */
  trackExpiry: boolean;
  /** أقرب صلاحية للكمية الصالحة (YYYY-MM-DD). */
  nearestExpiry: string | null;
  /** كمية منتهية الصلاحية لم تُعدم بعد. */
  expiredQty: number;
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
  /** عدد الأصناف (غير المحذوفة) في القسم. */
  productCount: number;
  version: number;
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
