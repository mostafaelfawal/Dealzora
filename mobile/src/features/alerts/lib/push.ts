/**
 * إشعارات push (Expo). التسجيل: قناة أندرويد «alerts» ← إذن المستخدم ← Expo push token ← الخادم.
 *
 * - Expo Go على أندرويد لا يدعم push البعيد (منذ SDK 53): يلزم development build (انظر README).
 * - المشروع يحتاج projectId من EAS (app.json: extra.eas.projectId، يُضاف بـ «eas init»).
 * - الـ token لا يُطبع ولا يُحفظ محلياً: يذهب للخادم فقط، والخادم يمسحه مع الخروج.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/api/instance";

export const ALERTS_CHANNEL = "alerts";

export type PushState = "enabled" | "denied" | "unsupported" | "not_configured" | "error";

export const PUSH_STATE_TEXT: Record<PushState, string> = {
  enabled: "الإشعارات مفعّلة على هذا الهاتف",
  denied: "الإشعارات مرفوضة من إعدادات الهاتف. فعّلها من إعدادات التطبيق في الهاتف",
  unsupported: "هذه النسخة (Expo Go) لا تستقبل الإشعارات. ثبّت نسخة التطبيق الكاملة",
  not_configured: "النسخة غير مجهزة للإشعارات بعد (ينقصها رقم مشروع EAS)",
  error: "تعذّر تفعيل الإشعارات الآن. حاول لاحقاً",
};

let handlerSet = false;

/** عرض الإشعار حتى والتطبيق مفتوح (مرة واحدة عند الإقلاع). */
export function setupNotificationHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | null {
  const id =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  return id || null;
}

/** فرق توقيت الهاتف عن UTC بالدقائق (مصر +120، ويتغير مع التوقيت الصيفي). */
export const utcOffsetMinutes = () => -new Date().getTimezoneOffset();

/** يطلب الإذن (لو لم يُسأل بعد) ويسجّل الـ token على الخادم. آمن للاستدعاء عند كل فتح. */
export async function registerForPush(): Promise<PushState> {
  if (!Device.isDevice) return "unsupported";
  try {
    if (Platform.OS === "android") {
      // أندرويد 13+: لا يظهر طلب الإذن قبل إنشاء قناة.
      await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL, {
        name: "تنبيهات الفروع",
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";
    const id = projectId();
    if (!id) return "not_configured";
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.request("/push-token", { method: "PUT", body: { token, utc_offset_minutes: utcOffsetMinutes() } });
    return "enabled";
  } catch (e) {
    // Expo Go على أندرويد يرمي هنا (push البعيد غير مدعوم فيه).
    const message = e instanceof Error ? e.message : "";
    return /expo go|not supported|ERR_NOTIFICATIONS/i.test(message) ? "unsupported" : "error";
  }
}
