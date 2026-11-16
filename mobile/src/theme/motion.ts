/**
 * الحركة: مدد ومنحنيات موحّدة لكل التطبيق، واحترام «تقليل الحركة» في إعدادات الهاتف
 * (حين يُفعَّل تظهر العناصر فوراً بلا انزلاق ولا عدّ).
 *
 * المبدأ: الحركة تشرح ما حدث (ظهر، تغيّر، ضُغط) ولا تؤخر المستخدم: كل دخول ≤ 320ms،
 * والتدرّج بين العناصر 40ms بحد أقصى 8 عناصر (القوائم الطويلة لا تنتظر).
 */
import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Easing } from "react-native";

export const duration = { fast: 140, base: 220, slow: 320, count: 700 } as const;

/** منحنى «خروج» ناعم: سريع في البداية ويهدأ عند الوصول (يشبه حركة iOS و Material 3). */
export const easeOut = Easing.bezier(0.2, 0.8, 0.2, 1);

export const spring = {
  /** ضغط الأزرار والبطاقات: سريع بلا ارتداد مزعج. */
  press: { speed: 40, bounciness: 0 },
  /** رجوع بعد الضغط وظهور الأيقونات: ارتداد خفيف. */
  pop: { speed: 18, bounciness: 8 },
  /** النوافذ السفلية. */
  sheet: { damping: 22, stiffness: 220, mass: 0.9 },
} as const;

export const STAGGER_MS = 40;
export const STAGGER_MAX = 8;

/** تأخير عنصر رقم index في قائمة متدرجة. */
export const staggerDelay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;

/* ---------- تقليل الحركة (قيمة واحدة لكل التطبيق) ---------- */

let reduced = false;
const listeners = new Set<() => void>();

void AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduced = v;
    listeners.forEach((l) => l());
  })
  .catch(() => undefined);

AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
  reduced = v;
  listeners.forEach((l) => l());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced, () => false);
}
