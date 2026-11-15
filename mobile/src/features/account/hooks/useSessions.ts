import { useQuery } from "@tanstack/react-query";

import { fetchSessions } from "../api/account.api";

export const sessionsKey = ["account", "sessions"] as const;

export function useSessions() {
  return useQuery({ queryKey: sessionsKey, queryFn: ({ signal }) => fetchSessions(signal) });
}
