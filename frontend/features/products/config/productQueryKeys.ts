import type { GetProductsParams } from "../api/products.api";

export const productKeys = {
  all: ["products"] as const,
  list: (params: GetProductsParams) => ["products", "list", params] as const,
  summary: ["products", "summary"] as const,
  detail: (id: string) => ["products", "detail", id] as const,
  categories: ["product-categories"] as const,
};
