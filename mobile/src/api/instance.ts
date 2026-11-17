/**
 * العميل الوحيد في التطبيق. كل الـ features تستورد api من هنا.
 * ردود الأفعال العامة (انتهاء الجلسة، الخطة، بيانات المستخدم) تُطبَّق هنا على حالة الدخول.
 */
import { getAuthState, setAuthState } from "@/features/auth/lib/authStore";
import { secureTokenStore } from "@/features/auth/lib/tokenStorage";
import { clearUser, saveUser } from "@/features/auth/lib/userCache";
import { clearPin } from "@/features/lock/lib/pin";
import { clearCachedData } from "@/lib/queryClient";
import { getServerUrl } from "@/lib/serverUrl";

import { ApiClient } from "./client";
import type { ApiError } from "./errors";
import type { MobileUser } from "./types";

/** مسح كل بيانات الحساب المحلية (التوكنات يمسحها العميل نفسه). */
export async function clearLocalAccountData(): Promise<void> {
  // الرمز السري مرتبط بالحساب: مستخدم جديد على نفس الهاتف لا يُقفل برمز غيره.
  await Promise.all([clearCachedData(), clearUser(), clearPin()]);
}

export function applyUser(user: MobileUser): void {
  void saveUser(user);
  setAuthState({ user });
}

export const api = new ApiClient({
  baseUrl: getServerUrl,
  tokens: secureTokenStore,
  onUser: applyUser,
  onSessionEnded: (error: ApiError) => {
    void clearLocalAccountData();
    setAuthState({
      status: "signedOut",
      user: null,
      currentPlan: null,
      notice: error.message,
    });
  },
  onPlanBlocked: (error: ApiError) => {
    const details = error.details as { current_plan?: unknown } | null;
    const plan =
      typeof details?.current_plan === "string" ? details.current_plan : null;
    if (getAuthState().status !== "signedOut")
      setAuthState({ status: "planBlocked", currentPlan: plan });
  },
});
