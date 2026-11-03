import { useQuery } from "@tanstack/react-query";

import { getProduct } from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";

export default function useGetProduct(id?: string | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ""),
    queryFn: () => getProduct(id as string),
    enabled: !!id,
  });
}
