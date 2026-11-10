import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { formatQty } from "@/lib/format";

import {
  adjustStock,
  fetchLedger,
  fetchStockReport,
} from "../api/inventory.api";
import { LEDGER_PAGE_SIZE, MOVEMENT_LABEL } from "../config/inventoryOptions";
import {
  INVENTORY_AFFECTED_KEYS,
  inventoryKeys,
} from "../config/inventoryQueryKeys";
import type { AdjustInput } from "../types/inventory";

export const useStockReport = (stagnantDays: number) =>
  useQuery({
    queryKey: inventoryKeys.report(stagnantDays),
    queryFn: () => fetchStockReport(stagnantDays),
  });

export const useLedger = (
  productId: string | null,
  page: number,
  pageSize = LEDGER_PAGE_SIZE,
) =>
  useQuery({
    queryKey: inventoryKeys.ledger(productId ?? "", page),
    queryFn: () => fetchLedger(productId as string, page, pageSize),
    enabled: Boolean(productId),
    placeholderData: keepPreviousData,
  });

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      input,
    }: {
      productId: string;
      input: AdjustInput;
    }) => adjustStock(productId, input),
    onSuccess: (m) => {
      for (const key of INVENTORY_AFFECTED_KEYS)
        void qc.invalidateQueries({ queryKey: key });
      toast.success(`تم تسجيل ${MOVEMENT_LABEL[m.type]}`, {
        description: `الرصيد الآن ${formatQty(m.balanceAfter)}`,
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تعديل المخزون")),
  });
}
