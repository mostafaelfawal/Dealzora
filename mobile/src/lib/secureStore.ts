/**
 * SecureStore (Keychain / Keystore): التوكنات ومعرّف الجهاز فقط.
 * THIS_DEVICE_ONLY: لا تُنسخ في نسخ iCloud الاحتياطية ولا تنتقل لهاتف آخر.
 */
import * as SecureStore from "expo-secure-store";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const SECURE_KEYS = {
  tokens: "dz.tokens",
  deviceId: "dz.device-id",
  lock: "dz.lock-enabled",
} as const;

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    // مفتاح تالف (مثلاً بعد استرجاع نسخة احتياطية): نتعامل معه كأنه غير موجود.
    return null;
  }
}

export function secureSet(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, OPTIONS);
}
