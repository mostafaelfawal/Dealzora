/**
 * إشعارات محلية حقيقية (في شريط الهاتف وبالصوت) للتنبيهات الجديدة من الخادم، حين لا يتوفر push البعيد
 * (Expo Go أو نسخة بلا Firebase). تعمل والتطبيق مفتوح أو في الخلفية لوقت قصير.
 *
 * - أول تشغيل: نسجّل التنبيهات الموجودة دون إشعار (لا سيل من القديم).
 * - كل تنبيه يُشعَر مرة واحدة (معرّفاته محفوظة)، وغير المقروء وآخر 24 ساعة فقط.
 * - أكثر من 3 جديدة معاً = إشعار واحد مجمّع (نفس قاعدة التجميع في الخادم).
 * - المحتوى نفس نص الخادم (بلا مبالغ: يظهر على شاشة القفل).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { AppNotification } from "@/api/types";
import { formatArabicCount } from "@/lib/format";

import { ALERTS_CHANNEL } from "./push";

const KEY = "dz.notified-alerts";
const KEEP = 200;
const MAX_SINGLE = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

let chain: Promise<void> = Promise.resolve();

async function readSeen(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

async function saveSeen(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ids.slice(0, KEEP))).catch(() => undefined);
}

/** التنبيهات التي تستحق إشعاراً الآن (منطق بلا أجهزة: مُختبر). */
export function pickNew(items: AppNotification[], seen: string[], now = Date.now()): AppNotification[] {
  const known = new Set(seen);
  return items.filter(
    (n) => !known.has(n.id) && !n.read_at && n.status !== "dropped" && now - Date.parse(n.created_at) < DAY_MS,
  );
}

async function show(title: string, body: string, url: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { url } },
    trigger: Platform.OS === "android" ? { channelId: ALERTS_CHANNEL } : null,
  });
}

async function run(items: AppNotification[]): Promise<void> {
  const seen = await readSeen();
  if (seen === null) {
    await saveSeen(items.map((n) => n.id)); // أول مرة: لا إشعار بالقديم
    return;
  }
  const fresh = pickNew(items, seen);
  if (fresh.length === 0) return;
  await saveSeen([...fresh.map((n) => n.id), ...seen]);
  if (fresh.length > MAX_SINGLE) {
    const count = formatArabicCount(fresh.length, { one: "تنبيه جديد", two: "تنبيهان جديدان", few: "تنبيهات جديدة", many: "تنبيهاً جديداً" });
    const titles = [...new Set(fresh.map((n) => n.title))].join("، ");
    await show(count, titles.slice(0, 180), "/alerts");
    return;
  }
  for (const n of fresh.reverse()) await show(n.title, n.body, n.route); // الأقدم أولاً
}

/** يُستدعى مع كل تحديث لقائمة التنبيهات. متسلسل (لا إشعار مكرر من تحديثين متقاربين). */
export function notifyNewAlerts(items: AppNotification[]): Promise<void> {
  chain = chain.then(() => run(items)).catch(() => undefined);
  return chain;
}

/** حساب جديد على نفس الهاتف: يبدأ من جديد (يُسجَّل القائم دون إشعار). */
export async function resetLocalAlerts(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
