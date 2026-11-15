/**
 * تحديث تلقائي بلا استنزاف للبطارية:
 * - فقط والشاشة ظاهرة (useIsFocused) والتطبيق في المقدمة (focusManager مربوط بـ AppState)
 *   ويوجد إنترنت (onlineManager يوقف الاستعلامات بدونه).
 * - فقط لبيانات تتغير الآن (فترة تشمل اليوم، أو حالة الفروع). الأيام الماضية لا تُحدَّث تلقائياً.
 * - الشاشة غير الظاهرة لا تشترك في الاستعلام أصلاً (subscribed: false).
 */
import { useIsFocused } from "expo-router";

export const LIVE_INTERVAL_MS = 60_000;

export function useLiveRefresh(live: boolean) {
  const focused = useIsFocused();
  return {
    subscribed: focused,
    refetchInterval: focused && live ? LIVE_INTERVAL_MS : (false as const),
    refetchIntervalInBackground: false,
  };
}
