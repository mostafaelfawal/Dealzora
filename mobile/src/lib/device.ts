/**
 * هوية الهاتف للخادم: معرّف عشوائي ثابت (يُولَّد مرة ويُحفظ في SecureStore) واسم يظهر في «الجلسات».
 * الخادم يحتفظ بجلسة واحدة لكل هاتف: دخول جديد من نفس الهاتف يلغي جلسته القديمة.
 */
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { Platform } from "react-native";

import type { LoginInput } from "@/api/types";

import { SECURE_KEYS, secureGet, secureSet } from "./secureStore";

export async function getDeviceId(): Promise<string> {
  const existing = await secureGet(SECURE_KEYS.deviceId);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await secureSet(SECURE_KEYS.deviceId, id);
  return id;
}

export function getDeviceName(): string {
  const name = Device.deviceName || Device.modelName || "هاتف";
  return name.slice(0, 80);
}

export function getPlatform(): LoginInput["platform"] {
  return Platform.OS === "android" || Platform.OS === "ios"
    ? Platform.OS
    : "other";
}
