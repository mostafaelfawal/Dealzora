/**
 * حالة الدخول (مخزن خارج React مثل lib/currency في البرنامج المكتبي): عميل الـ API يغيّرها
 * (انتهاء الجلسة، الخطة) والواجهة تقرأها بـ useAuth.
 *
 * loading     قراءة الجلسة المحفوظة عند الفتح
 * signedOut   شاشة الدخول (notice = سبب الخروج إن وُجد)
 * signedIn    التطبيق (حتى بلا إنترنت: آخر بيانات محفوظة)
 * planBlocked المحل ليس على خطة «سلسلة»: شاشة الترقية فقط
 */
import type { MobileUser } from "@/api/types";

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "planBlocked";

export interface AuthState {
  status: AuthStatus;
  user: MobileUser | null;
  /** رسالة لشاشة الدخول (مثلاً: انتهت الجلسة). */
  notice: string | null;
  /** الخطة الحالية للمحل في شاشة الترقية. */
  currentPlan: string | null;
}

let state: AuthState = {
  status: "loading",
  user: null,
  notice: null,
  currentPlan: null,
};
const listeners = new Set<() => void>();

export const getAuthState = () => state;

export function setAuthState(patch: Partial<AuthState>): void {
  const next = { ...state, ...patch };
  if (
    next.status === state.status &&
    next.user === state.user &&
    next.notice === state.notice &&
    next.currentPlan === state.currentPlan
  ) {
    return;
  }
  state = next;
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
