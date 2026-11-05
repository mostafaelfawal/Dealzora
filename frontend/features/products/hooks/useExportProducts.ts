import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import type { GetProductsParams } from "../api/products.api";
import { exportProducts } from "../lib/productExcel";

export default function useExportProducts() {
  return useMutation({
    mutationFn: (params: GetProductsParams) => exportProducts(params),
    onSuccess: (count) =>
      count === 0
        ? toast.info("لا توجد أصناف للتصدير")
        : toast.success(`تم تصدير ${count} صنف`),
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تصدير الأصناف")),
  });
}
