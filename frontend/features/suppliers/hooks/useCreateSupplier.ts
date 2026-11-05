import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { createSupplier } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";
import { toCreatePayload } from "../lib/supplierPayload";
import type { SupplierSchemaType } from "../schema/supplier.schema";

export default function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SupplierSchemaType) =>
      createSupplier(toCreatePayload(values)),
    onSuccess: (supplier) => {
      toast.success(`تمت إضافة «${supplier.name}»`);
      return queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
