import { useQuery } from "@tanstack/react-query";

import { getSupplier } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";

export default function useGetSupplier(id?: string | null) {
  return useQuery({
    queryKey: supplierKeys.detail(id ?? ""),
    queryFn: () => getSupplier(id as string),
    enabled: !!id,
  });
}
