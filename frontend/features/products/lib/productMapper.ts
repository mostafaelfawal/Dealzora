import type {
  CategoryDto,
  ProductDto,
  ProductsSummaryDto,
} from "../types/productApi";
import type {
  Product,
  ProductCategory,
  ProductsSummary,
} from "../types/product";

export const MONEY_SCALE = 100; // قروش → جنيه
export const QTY_SCALE = 1000; // الكميات × 1000

const money = (value: number) => value / MONEY_SCALE;
const qty = (value: number) => value / QTY_SCALE;

export function toProduct(dto: ProductDto): Product {
  return {
    id: dto.id,
    name: dto.name,
    barcode: dto.barcode ?? "",
    category: dto.category_id ?? "",
    categoryName: dto.category_name,
    unit: dto.unit,
    allowDecimal: dto.allow_decimal,
    costPrice: dto.cost_price === null ? null : money(dto.cost_price),
    salePrice: money(dto.sale_price),
    marginPercent: dto.margin_percent,
    stock: qty(dto.stock_qty),
    minStock: qty(dto.min_stock),
    scaleCode: dto.scale_code ?? null,
    wholesalePrice:
      dto.wholesale_price == null ? null : money(dto.wholesale_price),
    wholesaleMinQty:
      dto.wholesale_min_qty == null ? null : qty(dto.wholesale_min_qty),
    isActive: dto.is_active,
    version: dto.version,
    extraUnits: dto.extra_units.map((u) => ({
      id: u.id,
      name: u.name,
      factor: qty(u.factor),
      barcode: u.barcode ?? "",
      salePrice: u.sale_price === null ? null : money(u.sale_price),
    })),
  };
}

export const toSummary = (dto: ProductsSummaryDto): ProductsSummary => ({
  total: dto.total,
  low: dto.low,
  out: dto.out,
  stockValue: dto.stock_value === null ? null : money(dto.stock_value),
});

export const toCategory = (dto: CategoryDto): ProductCategory => ({
  id: dto.id,
  label: dto.name,
  productCount: dto.product_count,
  version: dto.version,
});
