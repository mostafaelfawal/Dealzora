import { api } from "@/api/instance";
import type { MobileSession } from "@/api/types";

export const fetchSessions = (signal?: AbortSignal) =>
  api.get<MobileSession[]>("/sessions", signal);
