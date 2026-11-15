import { api } from "@/lib/axios";

import type {
  CodeTableName,
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

export const fetchEtaCodes = async (table: CodeTableName) =>
  (await api.get<EtaCode[]>(`/eta/codes/${table}`)).data;
