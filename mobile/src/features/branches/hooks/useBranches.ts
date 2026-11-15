import { useQuery } from "@tanstack/react-query";

import { useLiveRefresh } from "@/hooks/useLiveRefresh";

import { fetchBranch, fetchBranches } from "../api/branches.api";

export const branchesKey = ["branches"] as const;

/** حالة الفروع تتغير لحظياً: تحديث كل دقيقة والشاشة ظاهرة فقط. */
export function useBranches() {
  const live = useLiveRefresh(true);
  return useQuery({ queryKey: branchesKey, queryFn: ({ signal }) => fetchBranches(signal), ...live });
}

export function useBranch(id: string) {
  const live = useLiveRefresh(true);
  return useQuery({ queryKey: ["branches", id], queryFn: ({ signal }) => fetchBranch(id, signal), ...live });
}
