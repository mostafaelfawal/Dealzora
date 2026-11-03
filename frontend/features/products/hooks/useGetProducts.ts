import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getProducts, type GetProductsParams } from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";

export default function useGetProducts(params: GetProductsParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => getProducts(params),
    // نُبقي الصفحة القديمة ظاهرة أثناء تحميل الجديدة (بدون وميض).
    placeholderData: keepPreviousData,
  });
}
