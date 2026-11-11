import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  createPairingCode,
  fetchNetwork,
  revokeDevice,
} from "../api/devices.api";

export const deviceKeys = { network: ["devices", "network"] as const };

/** قائمة الأجهزة تتحدث كل 15 ثانية (لرؤية «متصل الآن» ونجاح الاقتران فور حدوثه). */
export function useNetwork() {
  return useQuery({
    queryKey: deviceKeys.network,
    queryFn: fetchNetwork,
    refetchInterval: 15_000,
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
