import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { createSupplierPayment } from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";
import { parseNumber } from "../lib/supplierCalc";
import { MONEY_SCALE } from "../lib/supplierMapper";

interface PaymentVars {
  supplierId: string;
  supplierName: string;
  /** نص كما كتبه المستخدم (التحقق تم في النافذة). */
  amount: string;
  note: string;
}

export default function useCreateSupplierPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ supplierId, amount, note }: PaymentVars) =>
      createSupplierPayment(supplierId, {
        amount: Math.round(parseNumber(amount) * MONEY_SCALE),
        note: note.trim() || null,
      }),
    onSuccess: (_txn, vars) => {
      toast.success(`تم تسجيل دفعة لـ «${vars.supplierName}»`);
      return queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تسجيل الدفعة")),
  });
}
