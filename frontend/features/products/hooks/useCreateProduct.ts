import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { unitKeys } from "@/features/catalog/config/catalogQueryKeys";
import { extractErrorMessage } from "@/lib/errors";

import { createProduct } from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";
import { toCreatePayload } from "../lib/productPayload";
import type { ProductSchemaType } from "../schema/product.schema";

export default function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ProductSchemaType) =>
      createProduct(toCreatePayload(values)),
    onSuccess: (product) => {
      toast.success(`تمت إضافة «${product.name}»`);
      // الحفظ قد يضيف وحدة جديدة لقائمة الوحدات.
      void queryClient.invalidateQueries({ queryKey: unitKeys.all });
      return queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
