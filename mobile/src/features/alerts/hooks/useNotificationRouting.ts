/**
 * الضغط على إشعار يفتح الشاشة المعنية (حتى لو فُتح التطبيق من الإشعار وهو مغلق). مع جلسة مفتوحة فقط،
 * وقفل البصمة يغطي الشاشة حتى التأكيد. كذلك يسجّل push مرة لكل فتح للتطبيق.
 */
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

import { setupNotificationHandler } from "../lib/push";
import { syncPush } from "../lib/pushStore";
import { safeRoute } from "../lib/routes";

setupNotificationHandler();

function open(response: Notifications.NotificationResponse | null): void {
  const route = safeRoute(response?.notification.request.content.data?.url);
  if (!route) return;
  router.push(route as never);
  Notifications.clearLastNotificationResponse();
}

export function useNotificationRouting(signedIn: boolean): void {
  useEffect(() => {
    if (!signedIn) return;
    void syncPush();
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [signedIn]);
}
