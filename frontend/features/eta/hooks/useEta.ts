import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { unitKeys } from "@/features/catalog/config/catalogQueryKeys";
import { extractErrorMessage } from "@/lib/errors";
import { useFeature } from "@/lib/plan";

import {
  adoptChainAnchor,
  fetchEReceiptReport,
  fetchEnvironmentPreview,
  fetchQueue,
  fetchReceipts,
  resendReceipts,
  switchEnvironment,
  fetchSendAttempts,
  releaseHeldReturn,
  fetchSendStatus,
  sendReceiptsNow,
  testEtaConnection,
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
  EtaEnvironment,
  ReceiptFiltersQuery,
  ReceiptItem,
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

export const sendKeys = {
  status: ["eta", "send-status"] as const,
  attempts: ["eta", "attempts"] as const,
};

/** حالة الإرسال تتغير في الخلفية (كل دقيقة): نقرأها دورياً والشاشة مفتوحة. */
export function useSendStatus() {
  const allowed = useFeature("e_receipt");
  return useQuery({
    queryKey: sendKeys.status,
    queryFn: fetchSendStatus,
    enabled: allowed,
    refetchInterval: 30_000,
  });
}

export function useSendAttempts() {
  const allowed = useFeature("e_receipt");
  return useQuery({
    queryKey: sendKeys.attempts,
    queryFn: () => fetchSendAttempts(),
    enabled: allowed,
    refetchInterval: 30_000,
  });
}

export function useSendNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendReceiptsNow,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["eta"] });
      if (r.errors.length) toast.warning(r.errors[0]);
      else
        toast.success(
          `أُرسل ${r.submitted} إيصال · مقبول ${r.accepted} · مرفوض ${r.rejected}`,
        );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر الإرسال")),
  });
}

export function useReleaseReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: releaseHeldReturn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["eta"] });
      toast.success("سيُرسل المرتجع في الدورة التالية وتكمل السلسلة");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تنفيذ القرار")),
  });
}

/** مصادقة فقط ببيانات الجهاز، والنتيجة تُعرض بجانب الجهاز. */
export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: testEtaConnection,
    onSuccess: () => void qc.invalidateQueries({ queryKey: sendKeys.attempts }),
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر اختبار الاتصال")),
  });
}

export const useAdoptChainAnchor = () =>
  useEtaMutation(
    (deviceId: string) => adoptChainAnchor(deviceId),
    etaKeys.devices,
    "تم: السلسلة تكمل من آخر إيصال صدر. أعد توليد الإيصالات التي بها خطأ",
    "تعذّر اعتماد السلسلة",
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

/* ---------- متابعة الإيصالات (المرحلة 8) ---------- */

export const receiptKeys = {
  list: (f: ReceiptFiltersQuery) => ["eta", "receipts", f] as const,
  queue: ["eta", "queue"] as const,
  report: (from: string, to: string) => ["eta", "report", from, to] as const,
  environment: ["eta", "environment"] as const,
};

export function useReceipts(f: ReceiptFiltersQuery) {
  const allowed = useFeature("e_receipt");
  return useQuery({
    queryKey: receiptKeys.list(f),
    queryFn: () => fetchReceipts(f),
    enabled: allowed,
    placeholderData: (prev) => prev,
  });
}

/** أعداد الطابور (الكاشير والداشبورد): متاحة لأي مستخدم، وتتحدث بحدث realtime «e_receipt». */
export function useReceiptQueue() {
  const allowed = useFeature("e_receipt");
  return useQuery({
    queryKey: receiptKeys.queue,
    queryFn: fetchQueue,
    enabled: allowed,
    refetchInterval: 120_000,
  });
}

export function useEReceiptReport(from: string, to: string) {
  const allowed = useFeature("e_receipt");
  return useQuery({
    queryKey: receiptKeys.report(from, to),
    queryFn: () => fetchEReceiptReport(from, to),
    enabled: allowed,
  });
}

export function useResendReceipts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      items,
      acceptLate,
    }: {
      items: { kind: ReceiptItem["kind"]; id: string }[];
      acceptLate?: boolean;
    }) => resendReceipts(items, acceptLate),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["eta"] });
      void qc.invalidateQueries({ queryKey: ["sales"] });
      const done = r.corrected + r.regenerated + r.queued;
      if (done)
        toast.success(
          `تم: ${[
            r.corrected && `${r.corrected} تصحيح`,
            r.regenerated && `${r.regenerated} إعادة توليد`,
            r.queued && `${r.queued} للإرسال`,
          ]
            .filter(Boolean)
            .join(" · ")}. يتم الإرسال في الخلفية`,
        );
      if (r.errors.length)
        toast.error(
          r.errors.length === 1
            ? r.errors[0].message
            : `${r.errors.length} إيصال لم يُعد إرسالها: ${r.errors[0].message}`,
        );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّرت إعادة الإرسال")),
  });
}

export function useEnvironmentPreview(enabled: boolean) {
  return useQuery({
    queryKey: receiptKeys.environment,
    queryFn: fetchEnvironmentPreview,
    enabled,
  });
}

export function useSwitchEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      environment,
      confirmText,
    }: {
      environment: EtaEnvironment;
      confirmText: string;
    }) => switchEnvironment(environment, confirmText),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["eta"] });
      toast.success(
        r.environment === "prod"
          ? "تم التحويل للبيئة الفعلية. الإيصالات الجديدة تُرسل للمنظومة الفعلية"
          : "تم التحويل للبيئة التجريبية",
      );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تغيير البيئة")),
  });
}
