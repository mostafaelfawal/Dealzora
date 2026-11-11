import { invoke, isTauri } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";

/**
 * وضع هذا الجهاز (من Rust: %LOCALAPPDATA%\Dealzora\device.json).
 * - main: قاعدة البيانات والـ backend هنا (الافتراضي، وهو سلوك البرنامج دائماً قبل تعدد الأجهزة).
 * - terminal: جهاز كاشير يتصل بالـ backend على الجهاز الأساسي بتوكن جهاز.
 */
export interface DeviceConfig {
  mode: "main" | "terminal";
  lan_enabled: boolean;
  main_url: string | null;
  device_token: string | null;
  device_name: string | null;
}

export const MAIN_PORT = 8000;

const STANDALONE: DeviceConfig = {
  mode: "main",
  lan_enabled: false,
  main_url: null,
  device_token: null,
  device_name: null,
};

let loading: Promise<DeviceConfig> | null = null;
let current: DeviceConfig | null = null;
const listeners = new Set<() => void>();

/** يُقرأ مرة لكل تشغيل (تغيير الوضع يعيد تشغيل البرنامج من Rust). */
export function getDeviceConfig(): Promise<DeviceConfig> {
  if (!loading) {
    loading = (
      isTauri()
        ? invoke<DeviceConfig>("get_device_config").catch(() => STANDALONE)
        : Promise.resolve(STANDALONE)
    ).then((cfg) => {
      current = cfg;
      listeners.forEach((fn) => fn());
      return cfg;
    });
  }
  return loading;
}

/** null = لم يُقرأ بعد (أول لحظات التشغيل). */
export function useDeviceConfig(): DeviceConfig | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      void getDeviceConfig();
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
}

export const isTerminal = (cfg: DeviceConfig | null) =>
  cfg?.mode === "terminal" && !!cfg.main_url && !!cfg.device_token;

/** "192.168.1.10" أو "192.168.1.10:8000" أو "http://..." ← http://192.168.1.10:8000 */
export function normalizeMainUrl(input: string): string | null {
  let text = input.trim().replace(/\/+$/, "");
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `http://${text}`;
  try {
    const url = new URL(text);
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (!url.port) url.port = String(MAIN_PORT);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/* ---------- أوامر Rust (كلها تعيد تشغيل البرنامج عند النجاح) ---------- */

export const connectToMain = (
  mainUrl: string,
  deviceToken: string,
  deviceName: string,
) => invoke<void>("connect_to_main", { mainUrl, deviceToken, deviceName });

export const disconnectFromMain = () => invoke<void>("disconnect_from_main");

export const setLanEnabled = (enabled: boolean) =>
  invoke<void>("set_lan_enabled", { enabled });

export const getLicenseLease = () => invoke<string>("get_license_lease");

/** ينتظر رجوع الـ backend المحلي بعد إعادة تشغيله (تغيير وضع الشبكة/الجهاز). */
export async function waitForLocalBackend(
  timeoutMs = 30_000,
): Promise<boolean> {
  const origin =
    process.env.NEXT_PUBLIC_API_URL ?? `http://127.0.0.1:${MAIN_PORT}`;
  const until = Date.now() + timeoutMs;
  // مهلة قصيرة أولاً: العملية القديمة قد ترد قبل أن تُغلق تماماً.
  await new Promise((r) => setTimeout(r, 1500));
  while (Date.now() < until) {
    try {
      const res = await fetch(`${origin}/api/v1/devices/hello`, {
        cache: "no-store",
      });
      if (res.ok) return true;
    } catch {
      // لم يقلع بعد
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}
