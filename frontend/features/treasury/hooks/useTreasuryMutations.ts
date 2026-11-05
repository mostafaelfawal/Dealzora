import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText } from "@/lib/format";

import { createManualEntry, deleteCashEntry } from "../api/treasury.api";
import { treasuryKeys } from "../config/treasuryQueryKeys";
import type { TreasuryInput } from "../types/treasury";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: treasuryKeys.all });
}

export function useCreateManualEntry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: TreasuryInput) => createManualEntry(input),
    onSuccess: (_entry, input) => {
      void refresh();
      toast.success(
        `${input.direction === "in" ? "تم إيداع" : "تم سحب"} ${formatMoneyText(input.amount)}`,
      );
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تسجيل الحركة")),
  });
}

export function useDeleteCashEntry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deleteCashEntry(id, version),
    onSuccess: () => {
      void refresh();
      toast.success("تم حذف الحركة");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر حذف الحركة")),
  });
}
