import { api } from "@/lib/axios";

import { toSession } from "../lib/authMapper";
import type { AuthSession, LoginPayload } from "../types/auth";
import type { LoginDto } from "../types/authApi";

export const login = async (payload: LoginPayload): Promise<AuthSession> =>
  toSession((await api.post<LoginDto>("/auth/login", payload)).data);
