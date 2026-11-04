import { authStore } from "@/lib/axios";
import { USER_ROLES } from "../config/authOptions";
import type { AuthSession, LastLogin } from "../types/auth";

const SESSION_KEY = "dealzora:auth:session";
const LAST_LOGIN_KEY = "dealzora:auth:last-login";

// cookie للـ middleware فقط (مؤشر وجود جلسة، ليس توكن). بدون max-age = تنتهي بإغلاق التطبيق.
export const AUTH_COOKIE = "dz_logged_in";

const setCookie = () => {
  document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Strict`;
};
const clearCookie = () => {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
};

export function saveSession(session: AuthSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
  authStore.set(session.token);
  setCookie();
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
  authStore.clear();
  clearCookie();
}

export function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    const expired = !(Date.parse(session.expiresAt) > Date.now());
    if (!session.token || expired) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export const getAuthToken = () => readSession()?.token ?? null;

export function saveLastLogin(value: LastLogin) {
  try {
    localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function readLastLogin(): LastLogin | null {
  try {
    const raw = localStorage.getItem(LAST_LOGIN_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LastLogin>;
    if (
      typeof value.username !== "string" ||
      !USER_ROLES.includes(value.role as LastLogin["role"])
    )
      return null;
    return { role: value.role as LastLogin["role"], username: value.username };
  } catch {
    return null;
  }
}
