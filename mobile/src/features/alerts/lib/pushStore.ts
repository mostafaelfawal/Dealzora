/** حالة تسجيل push على هذا الهاتف (لشاشة الإعدادات). null = لم تُحسم بعد. */
import { useSyncExternalStore } from "react";

import { registerForPush, type PushState } from "./push";

let state: PushState | null = null;
let running: Promise<PushState> | null = null;
const listeners = new Set<() => void>();

const get = () => state;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** تسجيل واحد في نفس الوقت (فتح التطبيق + زر «إعادة المحاولة» معاً). */
export function syncPush(): Promise<PushState> {
  if (!running) {
    running = registerForPush()
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

export function resetPushState(): void {
  state = null;
  listeners.forEach((fn) => fn());
}

export function usePushState(): PushState | null {
  return useSyncExternalStore(subscribe, get, get);
}
