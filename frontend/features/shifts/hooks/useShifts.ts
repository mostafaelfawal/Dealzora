import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText } from "@/lib/format";
import { useFallbackInterval } from "@/lib/realtime";

import {
  closeShift,
  fetchCurrentShift,
  fetchShifts,
  openShift,
} from "../api/shifts.api";
import { shiftKeys } from "../config/shiftQueryKeys";

/** الوردية المفتوحة الآن (أو null). تتحدّث كل دقيقة لتحديث رصيد الدرج في الـ Header. */
export function useCurrentShift(enabled = true) {
  const interval = useFallbackInterval(60_000);
  return useQuery({
    queryKey: shiftKeys.current(),
    queryFn: fetchCurrentShift,
    enabled,
    refetchInterval: interval,
    staleTime: 15_000,
  });
}

export function useShiftsList(page: number, pageSize: number) {
  return useQuery({
    queryKey: shiftKeys.list(page, pageSize),
    queryFn: () => fetchShifts(page, pageSize),
    placeholderData: keepPreviousData,
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: shiftKeys.all });
    void qc.invalidateQueries({ queryKey: ["treasury"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useOpenShift() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (openingFloat: number) => openShift(openingFloat),
    onSuccess: () => {
      refresh();
      toast.success("تم فتح الوردية. بالتوفيق!");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر فتح الوردية")),
  });
}

export function useCloseShift() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ counted, note }: { counted: number; note: string }) =>
      closeShift(counted, note),
    onSuccess: (shift) => {
      refresh();
      const diff = shift.difference;
      if (diff === null) toast.success("تم قفل الوردية وتسليم الدرج");
      else if (diff === 0) toast.success("تم قفل الوردية · الدرج مطابق تماماً");
      else
        toast.warning(
          `تم قفل الوردية · ${diff > 0 ? "زيادة" : "عجز"} ${formatMoneyText(Math.abs(diff))}`,
          { duration: 10_000 },
        );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر قفل الوردية")),
  });
}
