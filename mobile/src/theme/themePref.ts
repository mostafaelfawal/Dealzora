/**
 * اختيار المظهر من داخل التطبيق: تلقائي (يتبع الهاتف) أو فاتح أو داكن. تفضيل لهذا الهاتف فقط
 * (AsyncStorage، ليس سراً). Appearance.setColorScheme يجعل عناصر النظام (نوافذ التنبيه، منتقي التاريخ،
 * شريط الحالة) تتبع نفس الاختيار، و useColorScheme يرجع القيمة المختارة.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";

export type ThemePref = "system" | "light" | "dark";
export const THEME_PREFS: readonly ThemePref[] = ["system", "light", "dark"];
export const THEME_LABEL: Record<ThemePref, string> = {
  system: "تلقائي",
  light: "فاتح",
  dark: "داكن",
};

const KEY = "dz.theme";
let pref: ThemePref = "system";
let loaded = false;
const listeners = new Set<() => void>();

const isPref = (v: unknown): v is ThemePref =>
  v === "system" || v === "light" || v === "dark";

function apply(next: ThemePref): void {
  pref = next;
  try {
    Appearance.setColorScheme(next === "system" ? "unspecified" : next);
  } catch {
    // الواجهة نفسها تتبع الاختيار من ThemeProvider حتى لو لم تدعمه المنصة
  }
  listeners.forEach((fn) => fn());
}

/** يُقرأ مرة عند الإقلاع (قبل إخفاء شاشة البداية: لا وميض بالمظهر الخطأ). */
export const themePrefReady: Promise<void> = AsyncStorage.getItem(KEY)
  .then((v) => {
    if (isPref(v) && v !== "system") apply(v);
  })
  .catch(() => undefined)
  .finally(() => {
    loaded = true;
    listeners.forEach((fn) => fn());
  });

export function setThemePref(next: ThemePref): void {
  apply(next);
  void AsyncStorage.setItem(KEY, next).catch(() => undefined);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    subscribe,
    () => pref,
    () => pref,
  );
}

export function useThemePrefLoaded(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => loaded,
  );
}
