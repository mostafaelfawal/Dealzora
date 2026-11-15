/** دورة الجلسة: الفتح، الدخول، الخروج. الحالة في authStore، والتوكنات يديرها عميل الـ API. */
import { api, applyUser, clearLocalAccountData } from "@/api/instance";
import { ApiError } from "@/api/errors";
import { formatArabicCount } from "@/lib/format";

import * as authApi from "../api/auth.api";
import { getAuthState, setAuthState } from "./authStore";
import { loadUser } from "./userCache";

/** عند فتح التطبيق: الجلسة المحفوظة تفتح التطبيق فوراً (حتى بلا إنترنت)، ثم نتحقق من الخادم. */
export async function bootstrapSession(): Promise<void> {
  if (!(await api.hasSession())) {
    setAuthState({ status: "signedOut" });
    return;
  }
  setAuthState({ status: "signedIn", user: await loadUser() });
  void refreshUser();
}

/**
 * يجلب الحساب من الخادم (الصلاحيات أو الخطة قد تتغير). انتهاء الجلسة والخطة يعالجهما العميل،
 * وانقطاع الإنترنت يُتجاهل (نبقى على آخر بيانات).
 * @returns true لو وصل الخادم ونجح.
 */
export async function refreshUser(): Promise<boolean> {
  try {
    const me = await authApi.fetchMe();
    applyUser(me);
    if (getAuthState().status === "planBlocked") setAuthState({ status: "signedIn", currentPlan: null });
    return true;
  } catch (error) {
    if (error instanceof ApiError && (error.isOffline || error.isPlanBlocked || error.isSessionEnded)) return false;
    throw error;
  }
}

export async function signIn(form: authApi.LoginForm): Promise<void> {
  // بيانات حساب سابق على نفس الهاتف لا تظهر للحساب الجديد.
  await clearLocalAccountData();
  const out = await authApi.login(form);
  setAuthState({ status: "signedIn", user: out.user, notice: null, currentPlan: null });
}

/** خروج هذا الهاتف (يعمل بلا إنترنت أيضاً). */
export async function signOut(): Promise<void> {
  const reached = await authApi.logout();
  await clearLocalAccountData();
  setAuthState({
    status: "signedOut",
    user: null,
    currentPlan: null,
    notice: reached ? null : "تم الخروج من هذا الهاتف. لم يصل الطلب للخادم، وستنتهي الجلسة هناك تلقائياً",
  });
}

/** الخروج من كل الأجهزة (يحتاج إنترنت: يرمي ApiError لو فشل والهاتف يبقى مسجلاً). */
export async function signOutEverywhere(): Promise<void> {
  const count = await authApi.logoutAll();
  await clearLocalAccountData();
  const devices = formatArabicCount(count, { one: "جهاز واحد", two: "جهازين", few: "أجهزة", many: "جهازاً" });
  setAuthState({ status: "signedOut", user: null, currentPlan: null, notice: `تم تسجيل الخروج من ${devices}` });
}
