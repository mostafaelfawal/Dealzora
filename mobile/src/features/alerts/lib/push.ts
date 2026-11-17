/**
 * إشعارات الهاتف: إذن المستخدم، ثم أفضل طريقة متاحة لهذه النسخة من التطبيق:
 *
 *   enabled          push من الخادم (Expo push token): يصل حتى والتطبيق مغلق. يحتاج نسخة التطوير/المتجر
 *                    + projectId من EAS + Firebase (انظر README). Expo Go على أندرويد لا يدعمه منذ SDK 53.
 *   local            إشعارات حقيقية في شريط الهاتف يُنشئها التطبيق نفسه عند وصول تنبيه جديد من الخادم
 *                    (localNotify). تعمل في Expo Go، لكن والتطبيق مفتوح أو في الخلفية لوقت قصير فقط.
 *   needs_permission لم يوافق المستخدم بعد ويمكن سؤاله (زر «تفعيل الإشعارات» بعد شرح، لا نافذة مفاجئة).
 *   denied           رفض نهائياً: التفعيل من إعدادات الهاتف فقط (زر يفتحها).
 *   unsupported      نسخة الويب (PWA): لا إشعارات Expo في المتصفح، والتنبيهات تظهر داخل التطبيق فقط.
 *
 * الـ token لا يُطبع ولا يُحفظ محلياً: يذهب للخادم فقط، والخادم يمسحه مع الخروج.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/api/instance";

export const ALERTS_CHANNEL = "alerts";

const WEB = Platform.OS === "web";

export type PushState =
  "enabled" | "local" | "needs_permission" | "denied" | "error" | "unsupported";

export const PUSH_STATE_TEXT: Record<PushState, string> = {
  enabled: "الإشعارات مفعّلة: تصلك التنبيهات حتى والتطبيق مغلق",
  local:
    "الإشعارات مفعّلة والتطبيق مفتوح. لتصلك والتطبيق مغلق ثبّت نسخة التطبيق الكاملة",
  needs_permission: "الإشعارات غير مفعّلة على هذا الهاتف",
  denied: "الإشعارات مرفوضة لهذا التطبيق. فعّلها من إعدادات الهاتف",
  error: "تعذّر تفعيل الإشعارات الآن. حاول لاحقاً",
  unsupported:
    "نسخة الويب لا تستقبل إشعارات على الهاتف: التنبيهات تظهر هنا داخل التطبيق. للإشعارات ثبّت تطبيق أندرويد",
};

let handlerSet = false;

/** عرض الإشعار حتى والتطبيق مفتوح (مرة واحدة عند الإقلاع). */
export function setupNotificationHandler(): void {
  if (handlerSet || WEB) return;
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

/**
 * أندرويد 13+: لا يظهر طلب الإذن قبل إنشاء قناة، والإشعار المحلي يحتاجها أيضاً.
 * فشلها لا يمنع طلب الإذن (كان يُرجع "error" قبل السؤال فلا تظهر النافذة أبداً).
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL, {
      name: "تنبيهات الفروع",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch {
    // القناة الافتراضية من إعداد expo-notifications تكفي
  }
}

function projectId(): string | null {
  const id =
    (
      Constants.expoConfig?.extra as
        { eas?: { projectId?: string } } | undefined
    )?.eas?.projectId ?? Constants.easConfig?.projectId;
  return id || null;
}

/** Expo Go (تطبيق المتجر للتجربة): push البعيد غير مدعوم فيه على أندرويد. */
const isExpoGo = () =>
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** فرق توقيت الهاتف عن UTC بالدقائق (مصر +120، ويتغير مع التوقيت الصيفي). */
export const utcOffsetMinutes = () => -new Date().getTimezoneOffset();

/**
 * يحدد حالة الإشعارات ويسجّل push لو متاح. ask=false (عند فتح التطبيق): لا تظهر نافذة الإذن أبداً.
 * ask=true (زر «تفعيل الإشعارات»): يطلب الإذن من النظام.
 */
export async function registerForPush({
  ask,
}: {
  ask: boolean;
}): Promise<PushState> {
  if (WEB) return "unsupported";
  try {
    await ensureChannel();
    let perm = await Notifications.getPermissionsAsync();
    // عند الضغط نطلب دائماً: canAskAgain قبل أول طلب قد يكون false على أندرويد (لا يفرّق بين «لم يُسأل» و«رفض نهائياً»)،
    // والنظام نفسه لا يُظهر النافذة لو الرفض نهائي فعلاً.
    if (perm.status !== "granted" && ask)
      perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== "granted")
      return !ask || perm.canAskAgain ? "needs_permission" : "denied";

    const id = projectId();
    if (!Device.isDevice || isExpoGo() || !id) return "local";
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: id,
      });
      await api.request("/push-token", {
        method: "PUT",
        body: { token, utc_offset_minutes: utcOffsetMinutes() },
      });
      return "enabled";
    } catch {
      return "local"; // push غير متاح (مثلاً Firebase غير مُعدّ): الإشعارات المحلية تعمل بدلاً منه
    }
  } catch {
    return "error";
  }
}

/** إشعار تجريبي فوري في شريط الهاتف (للتأكد من الإذن والصوت). */
export async function sendTestNotification(): Promise<void> {
  if (WEB) throw new Error("unsupported");
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Dealzora سلسلة",
      body: "الإشعارات تعمل على هذا الهاتف",
      data: { url: "/alerts" },
    },
    trigger: Platform.OS === "android" ? { channelId: ALERTS_CHANNEL } : null,
  });
}
