import { useQuery } from "@tanstack/react-query";

import { fetchBranches } from "../api/branches.api";

export const branchesKey = ["branches"] as const;

export function useBranches() {
  return useQuery({ queryKey: branchesKey, queryFn: ({ signal }) => fetchBranches(signal) });
}
