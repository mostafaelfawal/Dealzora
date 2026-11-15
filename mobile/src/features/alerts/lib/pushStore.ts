/** حالة إشعارات هذا الهاتف (للتنبيهات والإعدادات). null = لم تُحسم بعد. */
import { useSyncExternalStore } from "react";
import { Linking } from "react-native";

import { registerForPush, type PushState } from "./push";

let state: PushState | null = null;
let running: Promise<PushState> | null = null;
const listeners = new Set<() => void>();

const get = () => state;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function run(ask: boolean): Promise<PushState> {
  // الضغط على «تفعيل» أثناء فحص الإقلاع: ننتظره ثم نسأل (لا ننضم له، فهو لا يسأل).
  if (running && ask) return running.catch(() => null).then(() => run(true));
  if (!running) {
    running = registerForPush({ ask })
      .then((s) => {
        state = s;
        listeners.forEach((fn) => fn());
        return s;
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}

/** عند فتح التطبيق: يحدد الحالة ويسجّل push لو الإذن موجود، بلا نافذة إذن مفاجئة. */
export const syncPush = () => run(false);

/** زر «تفعيل الإشعارات»: يطلب الإذن من النظام. */
export const enablePush = () => run(true);

/** رُفض نهائياً: التفعيل من صفحة التطبيق في إعدادات الهاتف. */
export const openPhoneSettings = () => Linking.openSettings();

export function resetPushState(): void {
  state = null;
  listeners.forEach((fn) => fn());
}

export function usePushState(): PushState | null {
  return useSyncExternalStore(subscribe, get, get);
}
