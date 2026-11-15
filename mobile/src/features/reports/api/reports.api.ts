/** ملخصات الفروع (النواقص، الصلاحية، الورديات، العمليات الحساسة، الأكثر مبيعاً). الصلاحيات من الخادم. */
import { api } from "@/api/instance";
import type {
  BranchExpiring,
  BranchRecord,
  BranchShortages,
  ReportConfig,
  SensitiveData,
  ShiftData,
  TopSeller,
  Transfer,
} from "@/api/types";
import type { DateRange } from "@/lib/period";

const range = (r: DateRange) => new URLSearchParams({ date_from: r.from, date_to: r.to }).toString();

export const fetchShortages = (signal?: AbortSignal) => api.get<BranchShortages[]>("/stock/shortages", signal);
export const fetchExpiring = (signal?: AbortSignal) => api.get<BranchExpiring[]>("/stock/expiring", signal);
export const fetchShifts = (r: DateRange, signal?: AbortSignal) =>
  api.get<BranchRecord<ShiftData>[]>(`/shifts?${range(r)}`, signal);
export const fetchSensitive = (r: DateRange, signal?: AbortSignal) =>
  api.get<BranchRecord<SensitiveData>[]>(`/sensitive?${range(r)}`, signal);
export const fetchTopSellers = (r: DateRange, signal?: AbortSignal) =>
  api.get<TopSeller[]>(`/top-sellers?${range(r)}`, signal);

/** طلب تحويل باسم الفرع الناقص (to) من فرع فيه فائض (from): نفس طلب البرنامج، والطرف الآخر يوافق أو يرفض. */
export const requestTransfer = (body: { to_branch_id: string; from_branch_id: string; lines: { key: string; qty: number }[] }) =>
  api.post<Transfer>("/stock/request-transfer", body);

export const fetchReportConfig = (signal?: AbortSignal) => api.get<ReportConfig>("/admin/report-config", signal);
export const saveReportConfig = (c: ReportConfig) =>
  api.request<ReportConfig>("/admin/report-config", { method: "PUT", body: c });
