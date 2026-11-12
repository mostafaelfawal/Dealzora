export interface ProductUnitDto {
  id: string;
  name: string;
  factor: number;
  barcode: string | null;
  sale_price: number | null;
}

export interface ProductDto {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: string;
  allow_decimal: boolean;
  cost_price: number | null; // null للكاشير
  sale_price: number;
  margin_percent: number | null; // null للكاشير
  min_stock: number;
  scale_code: number | null;
  stock_qty: number;
  stock_level: "ok" | "low" | "out";
  is_active: boolean;
  extra_units: ProductUnitDto[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProductListDto {
  items: ProductDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductsSummaryDto {
  total: number;
  low: number;
  out: number;
  stock_value: number | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  product_count: number;
  version: number;
}

export interface ProductUnitPayload {
  id?: string;
  name: string;
  factor: number; // × 1000
  barcode: string | null;
  sale_price: number | null; // قروش
}

interface ProductPayloadBase {
  name: string;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  allow_decimal: boolean;
  cost_price: number; // قروش
  sale_price: number; // قروش
  min_stock: number; // × 1000
  scale_code: number | null;
  is_active: boolean;
  extra_units: ProductUnitPayload[];
}

export interface ProductCreatePayload extends ProductPayloadBase {
  opening_stock: number; // × 1000
}

export interface ProductUpdatePayload extends ProductPayloadBase {
  base_version: number;
}
