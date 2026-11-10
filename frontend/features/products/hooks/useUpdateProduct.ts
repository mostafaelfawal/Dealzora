import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { unitKeys } from "@/features/catalog/config/catalogQueryKeys";
import { extractErrorMessage } from "@/lib/errors";

import { updateProduct } from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";
import { toUpdatePayload } from "../lib/productPayload";
import type { ProductSchemaType } from "../schema/product.schema";

interface UpdateVars {
  id: string;
  values: ProductSchemaType;
  /** نسخة السجل وقت فتح التعديل (للتحكم في التعارض). */
  baseVersion: number;
}

export default function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values, baseVersion }: UpdateVars) =>
      updateProduct(id, toUpdatePayload(values, baseVersion)),
    onSuccess: (product) => {
      toast.success(`تم حفظ تعديلات «${product.name}»`);
      // الحفظ قد يضيف وحدة جديدة لقائمة الوحدات.
      void queryClient.invalidateQueries({ queryKey: unitKeys.all });
      return queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
