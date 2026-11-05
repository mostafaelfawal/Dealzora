import { useQuery } from "@tanstack/react-query";

import { getSuppliersSummary } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";

export default function useGetSuppliersSummary() {
  return useQuery({
    queryKey: supplierKeys.summary,
    queryFn: getSuppliersSummary,
  });
}
