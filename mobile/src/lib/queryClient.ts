/**
 * TanStack Query + حفظ آخر بيانات على الهاتف (AsyncStorage) لعرضها بلا إنترنت.
 *
 * - يُحفظ ناتج الاستعلامات فقط (فروع، جلسات…)، والتوكنات أبداً (هي في SecureStore وحدها).
 * - بلا إنترنت: الاستعلامات تتوقف (onlineManager) وتعرض المحفوظ، وتُستأنف تلقائياً عند الرجوع.
 * - عند الخروج يُمسح المحفوظ كله (لا يرى مستخدم آخر على نفس الهاتف بيانات سابقه).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, defaultShouldDehydrateQuery, focusManager, onlineManager, type Query } from "@tanstack/react-query";
import { addNetworkStateListener } from "expo-network";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError } from "@/api/errors";
import { isOnlineState } from "@/hooks/useOnline";

/** يتغير مع أي تغيير غير متوافق في شكل البيانات المحفوظة. */
export const CACHE_BUSTER = "dz-cache-v1";
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE, // لازم ≥ maxAge وإلا يُحذف قبل الحفظ
      staleTime: 30_000,
      retry: (count, error) => error instanceof ApiError && error.status >= 500 && count < 2,
    },
    mutations: { retry: false },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "dz.query-cache",
  throttleTime: 1000,
});

/**
 * ما لا يُحفظ على الهاتف أبداً (يُجلب حياً فقط): شاشات أمان المالك والأسعار والحدود. لا حاجة لها بلا إنترنت،
 * وحفظها في تخزين غير مشفّر يكشفها لمن يملك هاتفاً مسروقاً.
 */
const NEVER_PERSIST = new Set(["security", "prices"]);

export function shouldPersistQuery(query: Query): boolean {
  const [root, sub] = query.queryKey as unknown[];
  if (NEVER_PERSIST.has(String(root))) return false;
  if (root === "reports" && sub === "config") return false;
  return defaultShouldDehydrateQuery(query);
}

let wired = false;

/** مرة واحدة عند الإقلاع: الشبكة وحالة التطبيق ← TanStack Query. */
export function wireQueryManagers(): void {
  if (wired) return;
  wired = true;
  onlineManager.setEventListener((setOnline) => {
    const sub = addNetworkStateListener((state) => setOnline(isOnlineState(state)));
    return () => sub.remove();
  });
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener("change", (status: AppStateStatus) => setFocused(status === "active"));
    return () => sub.remove();
  });
}

export async function clearCachedData(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
