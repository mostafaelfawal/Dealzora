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
  ProductCreatePayload,
  ProductDto,
  ProductListDto,
  ProductsSummaryDto,
  ProductUpdatePayload,
} from "../types/productApi";
import { BulkItem, BulkResultDto, toBulkPayload } from "@/lib/bulk";

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

export const createProduct = async (payload: ProductCreatePayload) =>
  toProduct((await api.post<ProductDto>("/products", payload)).data);

export const updateProduct = async (
  id: string,
  payload: ProductUpdatePayload,
) => toProduct((await api.put<ProductDto>(`/products/${id}`, payload)).data);

export const toggleProductActive = async (id: string, baseVersion: number) =>
  toProduct(
    (
      await api.post<ProductDto>(`/products/${id}/toggle-active`, null, {
        params: { base_version: baseVersion },
      })
    ).data,
  );


export const bulkDeleteProducts = async (items: BulkItem[]) =>
  (await api.post<BulkResultDto>("/products/bulk-delete", toBulkPayload(items)))
    .data;

export const bulkDeactivateProducts = async (items: BulkItem[]) =>
  (
    await api.post<BulkResultDto>(
      "/products/bulk-deactivate",
      toBulkPayload(items),
    )
  ).data;

export const duplicateProduct = async (id: string) =>
  toProduct((await api.post<ProductDto>(`/products/${id}/duplicate`)).data);

export const deleteProduct = async (id: string, baseVersion: number) => {
  await api.delete(`/products/${id}`, {
    params: { base_version: baseVersion },
  });
};
