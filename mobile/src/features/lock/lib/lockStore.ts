/**
 * إعداد القفل بالبصمة (مفعّل افتراضياً لو الهاتف يدعمه). يُحفظ في SecureStore حتى لا يُطفأ
 * بتعديل ملفات التطبيق، وإيقافه نفسه يتطلب البصمة (في useLockSettings).
 */
import { SECURE_KEYS, secureGet, secureSet } from "@/lib/secureStore";

/** المدة في الخلفية قبل طلب البصمة مرة أخرى. */
export const IDLE_LOCK_MS = 60_000;

type Listener = () => void;

let enabled: boolean | null = null; // null = لم يُقرأ بعد
const listeners = new Set<Listener>();

export const getLockEnabled = () => enabled;

export async function loadLockEnabled(): Promise<boolean> {
  if (enabled === null) {
    enabled = (await secureGet(SECURE_KEYS.lock)) !== "off";
    listeners.forEach((fn) => fn());
  }
  return enabled;
}

export async function setLockEnabled(value: boolean): Promise<void> {
  await secureSet(SECURE_KEYS.lock, value ? "on" : "off");
  enabled = value;
  listeners.forEach((fn) => fn());
}

export function subscribeLock(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
