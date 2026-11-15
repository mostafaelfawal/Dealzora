/**
 * عنوان خادم المزامنة: من الإعدادات داخل التطبيق (يُكتب في شاشة الدخول)، والافتراضي من
 * EXPO_PUBLIC_SYNC_URL وقت البناء. ليس سراً (AsyncStorage)، والقراءة الأولى تُحفظ في الذاكرة.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { normalizeServerUrl } from "@/api/url";

const KEY = "dz.server-url";
const DEFAULT_URL = normalizeServerUrl(process.env.EXPO_PUBLIC_SYNC_URL);

let cached: string | null | undefined;

export async function getServerUrl(): Promise<string | null> {
  if (cached === undefined) {
    try {
      cached = normalizeServerUrl(await AsyncStorage.getItem(KEY)) ?? DEFAULT_URL;
    } catch {
      cached = DEFAULT_URL;
    }
  }
  return cached;
}

export async function setServerUrl(input: string): Promise<string> {
  const url = normalizeServerUrl(input);
  if (!url) throw new Error("عنوان الخادم غير صالح");
  await AsyncStorage.setItem(KEY, url);
  cached = url;
  return url;
}
