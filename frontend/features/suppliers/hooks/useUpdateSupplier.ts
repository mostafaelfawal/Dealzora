import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { updateSupplier } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";
import { toUpdatePayload } from "../lib/supplierPayload";
import type { SupplierSchemaType } from "../schema/supplier.schema";

interface UpdateVars {
  id: string;
  values: SupplierSchemaType;
  /** نسخة السجل وقت فتح التعديل (للتحكم في التعارض). */
  baseVersion: number;
}

export default function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values, baseVersion }: UpdateVars) =>
      updateSupplier(id, toUpdatePayload(values, baseVersion)),
    onSuccess: (supplier) => {
      toast.success(`تم حفظ تعديلات «${supplier.name}»`);
      return queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
