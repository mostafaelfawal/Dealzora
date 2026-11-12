import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { useRealtimeConnected } from "@/lib/realtime";

import {
  createPairingCode,
  fetchNetwork,
  revokeDevice,
} from "../api/devices.api";

export const deviceKeys = { network: ["devices", "network"] as const };

/** قائمة الأجهزة: لحظياً مع البث (اقتران/اتصال جهاز)، ودقيقة احتياطاً لتحول «متصل» إلى «غير متصل». */
export function useNetwork() {
  // «غير متصل» لا يُعلَن (هو غياب نشاط)، فنُبقي تحديثاً بطيئاً حتى مع البث.
  const live = useRealtimeConnected();
  return useQuery({
    queryKey: deviceKeys.network,
    queryFn: fetchNetwork,
    refetchInterval: live ? 60_000 : 15_000,
  });
}

export function useCreatePairingCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPairingCode,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: deviceKeys.network }),
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر إنشاء الكود")),
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => revokeDevice(id),
    onSuccess: (_r, v) =>
      toast.success(`أُلغي ربط «${v.name}». لن يستطيع الاتصال بعد الآن`),
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر إلغاء الربط")),
    onSettled: () => qc.invalidateQueries({ queryKey: deviceKeys.network }),
  });
}
