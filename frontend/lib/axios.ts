import { isTauri } from "@tauri-apps/api/core";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { getDeviceConfig, isTerminal } from "./device";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ---------- Tauri helpers ----------

async function tauriInvoke<T>(cmd: string): Promise<T | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd);
}

// ---------- App session token (من Rust) ----------
let appToken: string | null = null;

async function getAppToken(): Promise<string | null> {
  if (appToken) return appToken;
  appToken = await tauriInvoke<string>("get_session_token");
  return appToken;
}

// ---------- User token (بعد login) ----------
const AUTH_KEY = "dz_auth_token";
let authToken: string | null = null;

export const authStore = {
  get(): string | null {
    if (authToken) return authToken;
    if (typeof window !== "undefined")
      authToken = sessionStorage.getItem(AUTH_KEY);
    return authToken;
  },
  set(token: string) {
    authToken = token;
    if (typeof window !== "undefined") sessionStorage.setItem(AUTH_KEY, token);
  },
  clear() {
    authToken = null;
    if (typeof window !== "undefined") sessionStorage.removeItem(AUTH_KEY);
  },
};

export const AUTH_EXPIRED_EVENT = "dz:auth-expired";

/** جهاز الكاشير: حالة الاتصال بالجهاز الأساسي (لشريط «غير متصل»). */
export const MAIN_CONNECTION_EVENT = "dz:main-connection";
/** جهاز الكاشير: الجهاز الأساسي ألغى اقتران هذا الجهاز. */
export const DEVICE_UNPAIRED_EVENT = "dz:device-unpaired";

function emitConnection(online: boolean) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(MAIN_CONNECTION_EVENT, { detail: online }),
    );
}

// ---------- Write permit (من Rust بعد فحص الترخيص) ----------
const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);
const NO_PERMIT_PATHS = ["/auth/"];

async function getWritePermit(): Promise<string> {
  try {
    const permit = await tauriInvoke<string>("get_write_permit");
    if (!permit) throw new Error("not_in_tauri");
    return permit;
  } catch (e) {
    // الأكواد من Rust: license_not_started | license_expired | license_tampered | license_wrong_machine
    throw new ApiError(403, String(e), "الترخيص غير فعال");
  }
}

// ---------- Axios instance ----------
export const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const device = await getDeviceConfig();

  // جهاز كاشير: كل الطلبات للجهاز الأساسي بتوكن الجهاز. لا ترخيص محلي:
  // الكتابة مسموحة طالما ترخيص الجهاز الأساسي فعّال (يتحقق منه السيرفر).
  if (isTerminal(device)) {
    config.baseURL = `${device.main_url}/api/v1`;
    config.headers.set("X-Device-Token", device.device_token!);
    const user = authStore.get();
    if (user) config.headers.set("Authorization", `Bearer ${user}`);
    return config;
  }

  const [app, permit] = await Promise.all([
    getAppToken(),
    WRITE_METHODS.has((config.method ?? "get").toLowerCase()) &&
    !NO_PERMIT_PATHS.some((p) => config.url?.startsWith(p))
      ? getWritePermit()
      : Promise.resolve(null),
  ]);

  if (app) config.headers.set("X-Session-Token", app);

  const user = authStore.get();
  if (user) config.headers.set("Authorization", `Bearer ${user}`);

  if (permit) config.headers.set("X-Write-Permit", permit);

  return config;
});

// ---------- أخطاء موحدة: { code, message, details } ----------
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

api.interceptors.response.use(
  (res) => {
    emitConnection(true);
    return res;
  },
  (
    err: AxiosError<{
      error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | null;
      };
    }>,
  ) => {
    if ((err as unknown) instanceof ApiError) return Promise.reject(err);
    const status = err.response?.status ?? 0;
    const body = err.response?.data?.error;

    // أي رد من السيرفر (حتى لو خطأ) = الاتصال سليم. لا رد إطلاقاً = الجهاز الأساسي غير متاح.
    emitConnection(status !== 0);

    if (
      status === 401 &&
      body?.code === "unauthorized" &&
      typeof window !== "undefined"
    ) {
      authStore.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    if (
      status === 401 &&
      body?.code === "device_not_paired" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event(DEVICE_UNPAIRED_EVENT));
    }

    if (body)
      return Promise.reject(
        new ApiError(status, body.code, body.message, body.details),
      );
    if (status === 422) {
      // أخطاء Pydantic الافتراضية
      return Promise.reject(
        new ApiError(422, "validation_error", "بيانات غير صالحة"),
      );
    }
    return Promise.reject(
      new ApiError(
        status,
        "network_error",
        "تعذّر الاتصال بالجهاز الأساسي أو الخادم المحلي. تأكد أن البرنامج مفتوح عليه وأن الشبكة تعمل",
      ),
    );
  },
);
