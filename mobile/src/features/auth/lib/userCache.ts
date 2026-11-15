/**
 * آخر بيانات للمستخدم (الاسم، الدور، المحل، الفروع المسموحة) لفتح التطبيق بلا إنترنت.
 * ليست سراً (AsyncStorage)، والصلاحيات الفعلية يفرضها الخادم في كل طلب.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MobileUser } from "@/api/types";

const KEY = "dz.user";

export async function loadUser(): Promise<MobileUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MobileUser) : null;
  } catch {
    return null;
  }
}

export async function saveUser(user: MobileUser): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // التخزين ممتلئ: ليست مشكلة (يُجلب من الخادم مرة أخرى)
  }
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
