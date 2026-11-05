import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText } from "@/lib/format";

import {
  bulkDeactivateCustomers,
  bulkDeleteCustomers,
  collectPayment,
  deleteCustomer,
  saveCustomer,
  toggleCustomerActive,
} from "../api/customers.api";
import { customerKeys } from "../config/customerQueryKeys";
import type { CustomerInput, PaymentInput } from "../types/customer";
import { showBulkResult, type BulkItem } from "@/lib/bulk";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: customerKeys.all });
}

export function useSaveCustomer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      input,
      id,
      baseVersion,
    }: {
      input: CustomerInput;
      id?: string | null;
      baseVersion?: number;
    }) => saveCustomer(input, id, baseVersion),
    onSuccess: (_customer, { id }) => {
      void refresh();
      toast.success(id ? "تم حفظ التعديلات" : "تمت إضافة العميل");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر حفظ العميل")),
  });
}

export function useToggleCustomer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      toggleCustomerActive(id, version),
    onSuccess: (c) => {
      void refresh();
      toast.success(c.isActive ? "تم تفعيل العميل" : "تم تعطيل العميل");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تغيير الحالة")),
  });
}

export function useDeleteCustomer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deleteCustomer(id, version),
    onSuccess: () => {
      void refresh();
      toast.success("تم حذف العميل");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر حذف العميل")),
  });
}

export function useCollectPayment() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: PaymentInput }) =>
      collectPayment(id, payment),
    onSuccess: (_c, { payment }) => {
      void refresh();
      toast.success(`تم تحصيل ${formatMoneyText(payment.amount)}`);
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تسجيل الدفعة")),
  });
}

export function useBulkDeleteCustomers() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (items: BulkItem[]) => bulkDeleteCustomers(items),
    onSuccess: (result) => showBulkResult(result, "تم حذف", "عميل"),
    onError: (error) => toast.error(extractErrorMessage(error, "تعذّر الحذف")),
    onSettled: () => void refresh(),
  });
}

export function useBulkDeactivateCustomers() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (items: BulkItem[]) => bulkDeactivateCustomers(items),
    onSuccess: (result) => showBulkResult(result, "تم تعطيل", "عميل"),
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر التعطيل")),
    onSettled: () => void refresh(),
  });
}
