import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { unitKeys } from "@/features/catalog/config/catalogQueryKeys";
import { extractErrorMessage } from "@/lib/errors";
import { useFeature } from "@/lib/plan";

import {
  fetchEtaBranch,
  fetchEtaCodes,
  fetchEtaConfig,
  fetchEtaDevices,
  fetchEtaReadiness,
  fetchEtaUnits,
  saveEtaBranch,
  saveEtaConfig,
  saveEtaDevice,
  saveEtaUnit,
} from "../api/eta.api";
import type {
  CodeTableName,
  EtaBranch,
  EtaConfig,
  EtaDeviceInput,
} from "../types/eta";

export const etaKeys = {
  all: ["eta"] as const,
  config: ["eta", "config"] as const,
  branch: ["eta", "branch"] as const,
  devices: ["eta", "devices"] as const,
  units: ["eta", "units"] as const,
  readiness: ["eta", "readiness"] as const,
  codes: (t: CodeTableName) => ["eta", "codes", t] as const,
};

/** القراءة فقط لو الخطة تسمح (وإلا السيرفر يرد 403 بلا فائدة). */
function useEtaQuery<T>(key: readonly unknown[], fn: () => Promise<T>) {
  const allowed = useFeature("e_receipt");
  return useQuery({ queryKey: key, queryFn: fn, enabled: allowed });
}

export const useEtaConfig = () => useEtaQuery(etaKeys.config, fetchEtaConfig);
export const useEtaBranch = () => useEtaQuery(etaKeys.branch, fetchEtaBranch);
export const useEtaDevices = () =>
  useEtaQuery(etaKeys.devices, fetchEtaDevices);
export const useEtaUnits = () => useEtaQuery(etaKeys.units, fetchEtaUnits);
export const useEtaReadiness = () =>
  useEtaQuery(etaKeys.readiness, fetchEtaReadiness);

/** جداول الأكواد ثابتة (من الـ SDK): تُجلب مرة واحدة. */
export function useEtaCodes(table: CodeTableName) {
  const allowed = useFeature("e_receipt");
  return useQuery({
    queryKey: etaKeys.codes(table),
    queryFn: () => fetchEtaCodes(table),
    enabled: allowed,
    staleTime: Infinity,
  });
}

/** أي حفظ يغيّر الجاهزية، فنعيد قراءتها مع المورد نفسه. */
function useEtaMutation<V, R>(
  fn: (v: V) => Promise<R>,
  key: readonly unknown[],
  success: string | ((r: R) => string),
  failure: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: etaKeys.readiness });
      toast.success(typeof success === "string" ? success : success(r));
    },
    onError: (e) => {
      // التفعيل المرفوض: القائمة المحدّثة تشرح ما ينقص.
      void qc.invalidateQueries({ queryKey: etaKeys.readiness });
      toast.error(extractErrorMessage(e, failure));
    },
  });
}

export const useSaveEtaConfig = () =>
  useEtaMutation(
    (c: EtaConfig) => saveEtaConfig(c),
    etaKeys.config,
    (c) =>
      c.enabled
        ? "تم تفعيل الإيصال الإلكتروني"
        : "تم حفظ بيانات المحل في المنظومة",
    "تعذّر حفظ إعدادات المنظومة",
  );

export const useSaveEtaBranch = () =>
  useEtaMutation(
    (b: EtaBranch) => saveEtaBranch(b),
    etaKeys.branch,
    "تم حفظ بيانات الفرع",
    "تعذّر حفظ بيانات الفرع",
  );

export const useSaveEtaDevice = () =>
  useEtaMutation(
    ({ id, data }: { id: string; data: EtaDeviceInput }) =>
      saveEtaDevice(id, data),
    etaKeys.devices,
    "تم حفظ بيانات الجهاز",
    "تعذّر حفظ بيانات الجهاز",
  );

export const useSaveEtaUnit = () => {
  const qc = useQueryClient();
  return useEtaMutation(
    ({ id, code }: { id: string; code: string | null }) => {
      // قائمة الوحدات في شاشات أخرى تعرض الكود أيضاً.
      void qc.invalidateQueries({ queryKey: unitKeys.all });
      return saveEtaUnit(id, code);
    },
    etaKeys.units,
    (u) =>
      u.eta_unit_type
        ? `«${u.name}» = ${u.eta_unit_type}`
        : `أُزيل كود «${u.name}»`,
    "تعذّر حفظ كود الوحدة",
  );
};
