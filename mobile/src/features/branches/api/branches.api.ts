import { api } from "@/api/instance";
import type { MobileBranch } from "@/api/types";

/** الفروع المسموحة فقط (الخادم يفرض الصلاحية: المدير يرى فروعه). */
export const fetchBranches = (signal?: AbortSignal) =>
  api.get<MobileBranch[]>("/branches", signal);

/** فرع مسموح (غير المسند = 404 من الخادم). */
export const fetchBranch = (id: string, signal?: AbortSignal) =>
  api.get<MobileBranch>(`/branches/${encodeURIComponent(id)}`, signal);
