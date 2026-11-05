import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { showBulkResult, type BulkItem } from "@/lib/bulk";
import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText } from "@/lib/format";

import {
  bulkDeleteExpenses,
  createExpense,
  deleteExpense,
  updateExpense,
} from "../api/expenses.api";
import { expenseKeys } from "../config/expenseQueryKeys";
import type { ExpenseInput } from "../types/expense";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expenseKeys.all });
}

/** id موجود = تعديل (يحتاج baseVersion)، وغيابه = إضافة. */
export function useSaveExpense() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      input,
      id,
      baseVersion,
    }: {
      input: ExpenseInput;
      id?: string | null;
      baseVersion?: number;
    }) => {
      if (!id) return createExpense(input);
      if (baseVersion === undefined) throw new Error("baseVersion مطلوب للتعديل");
      return updateExpense(id, input, baseVersion);
    },
    onSuccess: (_expense, { id, input }) => {
      void refresh();
      toast.success(
        id ? "تم حفظ التعديلات" : `تم تسجيل مصروف ${formatMoneyText(input.amount)}`,
      );
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر حفظ المصروف")),
  });
}

export function useDeleteExpense() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deleteExpense(id, version),
    onSuccess: () => {
      void refresh();
      toast.success("تم حذف المصروف");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر حذف المصروف")),
  });
}

export function useBulkDeleteExpenses() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (items: BulkItem[]) => bulkDeleteExpenses(items),
    onSuccess: (result) => showBulkResult(result, "تم حذف", "مصروف"),
    onError: (error) => toast.error(extractErrorMessage(error, "تعذّر الحذف")),
    onSettled: () => void refresh(),
  });
}