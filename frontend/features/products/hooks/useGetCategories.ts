import { useQuery } from "@tanstack/react-query";

import { getCategories } from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";

export default function useGetCategories() {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  });
}
