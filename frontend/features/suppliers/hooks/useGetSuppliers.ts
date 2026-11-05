import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getSuppliers, type GetSuppliersParams } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";

export default function useGetSuppliers(params: GetSuppliersParams) {
  return useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: () => getSuppliers(params),
    // نُبقي الصفحة القديمة ظاهرة أثناء تحميل الجديدة (بدون وميض).
    placeholderData: keepPreviousData,
  });
}
