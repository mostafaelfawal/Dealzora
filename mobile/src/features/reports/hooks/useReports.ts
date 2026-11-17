import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Alert } from "react-native";

import { errorMessage } from "@/api/errors";
import type { ReportConfig } from "@/api/types";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { includesToday, type DateRange } from "@/lib/period";

import {
  fetchExpiring,
  fetchReportConfig,
  fetchSensitive,
  fetchShifts,
  fetchShortages,
  fetchTopSellers,
  requestTransfer,
  saveReportConfig,
} from "../api/reports.api";

/** الفروع ترفع ملخصاتها كل 5 دقائق تقريباً: تحديث تلقائي هادئ والشاشة ظاهرة فقط. */
function useReportRefresh(live: boolean) {
  const r = useLiveRefresh(live);
  return {
    ...r,
    refetchInterval: r.refetchInterval === false ? (false as const) : 120_000,
  };
}

export function useShortages() {
  return useQuery({
    queryKey: ["reports", "shortages"],
    queryFn: ({ signal }) => fetchShortages(signal),
    ...useReportRefresh(true),
  });
}

export function useExpiring() {
  return useQuery({
    queryKey: ["reports", "expiring"],
    queryFn: ({ signal }) => fetchExpiring(signal),
    ...useReportRefresh(true),
  });
}

export function useShifts(range: DateRange) {
  return useQuery({
    queryKey: ["reports", "shifts", range.from, range.to],
    queryFn: ({ signal }) => fetchShifts(range, signal),
    placeholderData: keepPreviousData,
    ...useReportRefresh(includesToday(range)),
  });
}

export function useSensitive(range: DateRange) {
  return useQuery({
    queryKey: ["reports", "sensitive", range.from, range.to],
    queryFn: ({ signal }) => fetchSensitive(range, signal),
    placeholderData: keepPreviousData,
    ...useReportRefresh(includesToday(range)),
  });
}

export function useTopSellers(range: DateRange) {
  return useQuery({
    queryKey: ["reports", "top", range.from, range.to],
    queryFn: ({ signal }) => fetchTopSellers(range, signal),
    placeholderData: keepPreviousData,
    ...useReportRefresh(includesToday(range)),
  });
}

export function useRequestTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestTransfer,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["transfers"] }),
    onError: (e) => Alert.alert("تعذّر إنشاء طلب التحويل", errorMessage(e)),
  });
}

export function useReportConfig(enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "config"],
    queryFn: ({ signal }) => fetchReportConfig(signal),
    enabled,
  });
}

export function useSaveReportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: ReportConfig) => saveReportConfig(c),
    onSuccess: (c) => qc.setQueryData(["reports", "config"], c),
    onError: (e) => Alert.alert("لم تُحفظ الحدود", errorMessage(e)),
  });
}
