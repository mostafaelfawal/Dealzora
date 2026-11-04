import type { UserRole } from "../config/authOptions";

export type { UserRole };

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LastLogin {
  role: UserRole;
  username: string;
}
