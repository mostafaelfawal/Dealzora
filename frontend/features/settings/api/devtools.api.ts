import { api } from "@/lib/axios";

/** التوليد يمر بكل خدمات النظام (مئات الفواتير)، فيحتاج مهلة أطول من الافتراضي. */
const LONG_TIMEOUT = 5 * 60_000;

export interface DemoStatus {
  enabled: boolean;
  loaded: boolean;
  records: number;
  tables: Record<string, number>;
  demo_password: string;
}

export interface SeedResult {
  days: number;
  records: number;
  seconds: number;
  sales: number;
  returns: number;
  purchases: number;
  products: number;
  customers: number;
  suppliers: number;
}

export interface ClearResult {
  deleted: number;
  seconds: number;
}

export const fetchDemoStatus = async () =>
  (await api.get<DemoStatus>("/dev/demo")).data;

export const seedDemo = async () =>
  (await api.post<SeedResult>("/dev/demo", null, { timeout: LONG_TIMEOUT }))
    .data;

export const clearDemo = async () =>
  (await api.delete<ClearResult>("/dev/demo", { timeout: LONG_TIMEOUT })).data;
