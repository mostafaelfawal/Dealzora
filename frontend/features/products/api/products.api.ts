import { api } from "@/lib/axios";

import { toCategory, toProduct, toSummary } from "../lib/productMapper";
import type {
  Product,
  ProductCategory,
  ProductsPage,
  ProductsSummary,
  SortKey,
  StockFilter,
} from "../types/product";
import type {
  CategoryDto,
  ProductDto,
  ProductListDto,
  ProductsSummaryDto,
} from "../types/productApi";

/** أسماء الـ query params كما يتوقعها الـ backend. القيم undefined لا تُرسل. */
export interface GetProductsParams {
  q?: string;
  category_id?: string;
  stock?: StockFilter;
  sort?: SortKey;
  page?: number;
  page_size?: number;
}

export const getProducts = async (
  params: GetProductsParams,
): Promise<ProductsPage> => {
  const { data } = await api.get<ProductListDto>("/products", { params });
  return {
    items: data.items.map(toProduct),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  };
};

export const getProduct = async (id: string): Promise<Product> =>
  toProduct((await api.get<ProductDto>(`/products/${id}`)).data);

export const getProductsSummary = async (): Promise<ProductsSummary> =>
  toSummary((await api.get<ProductsSummaryDto>("/products/summary")).data);

export const getCategories = async (): Promise<ProductCategory[]> =>
  (await api.get<CategoryDto[]>("/products/categories")).data.map(toCategory);

export const toggleProductActive = async (id: string, baseVersion: number) =>
  toProduct(
    (
      await api.post<ProductDto>(`/products/${id}/toggle-active`, null, {
        params: { base_version: baseVersion },
      })
    ).data,
  );

export const duplicateProduct = async (id: string) =>
  toProduct((await api.post<ProductDto>(`/products/${id}/duplicate`)).data);

export const deleteProduct = async (id: string, baseVersion: number) => {
  await api.delete(`/products/${id}`, {
    params: { base_version: baseVersion },
  });
};
