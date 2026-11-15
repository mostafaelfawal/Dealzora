/** دخول وخروج الهاتف (POST /mobile/v1/auth/*) وبيانات الحساب (GET /mobile/v1/me). */
import { api } from "@/api/instance";
import type { MobileTokens, MobileUser } from "@/api/types";
import { getDeviceId, getDeviceName, getPlatform } from "@/lib/device";

export interface LoginForm {
  code: string;
  username: string;
  password: string;
}

export async function login(form: LoginForm): Promise<MobileTokens> {
  return api.login({
    code: form.code,
    username: form.username.trim().toLowerCase(),
    password: form.password,
    device_id: await getDeviceId(),
    device_name: getDeviceName(),
    platform: getPlatform(),
  });
}

export const fetchMe = () => api.get<MobileUser>("/me");
export const logout = () => api.logout();
export const logoutAll = () => api.logoutAll();
