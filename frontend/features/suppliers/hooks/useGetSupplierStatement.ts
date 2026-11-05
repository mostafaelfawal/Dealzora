import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getSupplierStatement } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";

export default function useGetSupplierStatement(
  id: string | null,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: supplierKeys.statement(id ?? "", page, pageSize),
    queryFn: () =>
      getSupplierStatement(id as string, { page, page_size: pageSize }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}
