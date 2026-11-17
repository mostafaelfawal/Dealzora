/**
 * SecureStore (Keychain / Keystore): التوكنات ومعرّف الجهاز وإعدادات القفل.
 * THIS_DEVICE_ONLY: لا تُنسخ في نسخ iCloud الاحتياطية ولا تنتقل لهاتف آخر.
 *
 * نسخة الويب (PWA): لا Keychain في المتصفح، فالتخزين في localStorage الخاص بنطاق التطبيق.
 * مسح بيانات الموقع يمسح التوكنات والرمز السري معاً (خروج كامل، لا تجاوز للقفل).
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const WEB = Platform.OS === "web";

function webStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // تصفح خاص أو تخزين محظور
  }
}

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const SECURE_KEYS = {
  tokens: "dz.tokens",
  deviceId: "dz.device-id",
  lock: "dz.lock-enabled",
  pin: "dz.lock-pin",
  pinFails: "dz.lock-pin-fails",
} as const;

export async function secureGet(key: string): Promise<string | null> {
  if (WEB) return webStorage()?.getItem(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    // مفتاح تالف (مثلاً بعد استرجاع نسخة احتياطية): نتعامل معه كأنه غير موجود.
    return null;
  }
}

export function secureSet(key: string, value: string): Promise<void> {
  if (WEB) {
    webStorage()?.setItem(key, value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function secureDelete(key: string): Promise<void> {
  if (WEB) {
    webStorage()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key, OPTIONS);
}
