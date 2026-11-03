import { useQuery } from "@tanstack/react-query";

import { getProductsSummary } from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";

export default function useGetProductsSummary() {
  return useQuery({
    queryKey: productKeys.summary,
    queryFn: getProductsSummary,
  });
}
