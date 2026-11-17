import { cleanParams } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  CodeTableName,
  ConnectionTest,
  EReceiptReport,
  EnvironmentPreview,
  EtaEnvironment,
  QueueInfo,
  ReceiptFiltersQuery,
  ReceiptItem,
  ReceiptList,
  ResendResult,
  SendAttempt,
  SendCycle,
  SendStatus,
  EtaBranch,
  EtaCode,
  EtaConfig,
  EtaDevice,
  EtaDeviceInput,
  EtaUnit,
  Readiness,
} from "../types/eta";

/** كل المسارات لخطة «سلسلة» وللمدير (السيرفر يرفض غير ذلك برسالة الترقية). */

export const fetchEtaConfig = async () =>
  (await api.get<EtaConfig>("/eta/config")).data;

export const saveEtaConfig = async (config: EtaConfig) =>
  (await api.put<EtaConfig>("/eta/config", config)).data;

export const fetchEtaBranch = async () =>
  (await api.get<EtaBranch>("/eta/branch")).data;

export const saveEtaBranch = async (branch: EtaBranch) =>
  (await api.put<EtaBranch>("/eta/branch", branch)).data;

export const fetchEtaDevices = async () =>
  (await api.get<EtaDevice[]>("/eta/devices")).data;

export const saveEtaDevice = async (id: string, data: EtaDeviceInput) =>
  (await api.put<EtaDevice>(`/eta/devices/${encodeURIComponent(id)}`, data))
    .data;

export const fetchEtaUnits = async () =>
  (await api.get<EtaUnit[]>("/eta/units")).data;

export const saveEtaUnit = async (id: string, code: string | null) =>
  (
    await api.put<EtaUnit>(`/eta/units/${encodeURIComponent(id)}`, {
      eta_unit_type: code,
    })
  ).data;

export const fetchEtaReadiness = async () =>
  (await api.get<Readiness>("/eta/readiness")).data;

/** بعد استعادة نسخة قديمة: السلسلة تكمل من آخر إيصال صدر فعلاً (المرساة). */
export const adoptChainAnchor = async (deviceId: string) => {
  await api.post(
    `/e-receipt/chains/${encodeURIComponent(deviceId)}/adopt-anchor`,
  );
};

/* ---------- الاتصال بالمنظومة ---------- */

export const testEtaConnection = async (deviceId: string) =>
  (
    await api.post<ConnectionTest>(
      `/e-receipt/devices/${encodeURIComponent(deviceId)}/test-connection`,
    )
  ).data;

/** إرسال مرتجع رغم رفض فاتورته الأصلية (يفك إيقاف سلسلة الجهاز). */
export const releaseHeldReturn = async (returnId: string) => {
  await api.post(`/e-receipt/returns/${encodeURIComponent(returnId)}/release`);
};

export const sendReceiptsNow = async () =>
  (await api.post<SendCycle>("/e-receipt/send-now")).data;

export const fetchSendStatus = async () =>
  (await api.get<SendStatus>("/e-receipt/send-status")).data;

export const fetchSendAttempts = async (limit = 20) =>
  (await api.get<SendAttempt[]>("/e-receipt/attempts", { params: { limit } }))
    .data;

export const fetchEtaCodes = async (table: CodeTableName) =>
  (await api.get<EtaCode[]>(`/eta/codes/${table}`)).data;

/* ---------- متابعة الإيصالات ---------- */

export const fetchReceipts = async (f: ReceiptFiltersQuery) =>
  (
    await api.get<ReceiptList>("/e-receipt/receipts", {
      params: cleanParams({ ...f }),
    })
  ).data;

export const resendReceipts = async (
  items: { kind: ReceiptItem["kind"]; id: string }[],
  acceptLate = false,
) =>
  (
    await api.post<ResendResult>("/e-receipt/receipts/resend", {
      items,
      accept_late: acceptLate,
    })
  ).data;

export const fetchQueue = async () =>
  (await api.get<QueueInfo>("/e-receipt/queue")).data;

export const fetchEReceiptReport = async (from: string, to: string) =>
  (
    await api.get<EReceiptReport>("/e-receipt/report", {
      params: { date_from: from, date_to: to },
    })
  ).data;

export const fetchEnvironmentPreview = async () =>
  (await api.get<EnvironmentPreview>("/e-receipt/environment")).data;

export const switchEnvironment = async (
  environment: EtaEnvironment,
  confirmText: string,
) =>
  (
    await api.post<{ environment: EtaEnvironment; closed: number }>(
      "/e-receipt/environment",
      { environment, confirm_text: confirmText },
    )
  ).data;
