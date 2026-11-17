/**
 * RTL عربي إجباري.
 *
 * - البناء الأصلي (development/release build): إضافة expo-localization بـ forcesRTL في app.json
 *   تجعل I18nManager.isRTL = true من أول تشغيل.
 * - Expo Go يتجاهل forcesRTL ويعيد ضبط RTL: نطلب forceRTL (يسري بعد إعادة فتح التطبيق)، وحتى ذلك
 *   الحين الجذر يأخذ direction: "rtl" فيُقلب التخطيط كله فوراً.
 * - النصوص: RN يبدّل left/right تلقائياً فقط حين I18nManager.isRTL، فنحسب «بداية السطر» هنا.
 */
import { I18nManager, type TextStyle } from "react-native";

export function ensureRTL(): void {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
}

/** محاذاة بداية السطر العربي (يمين الشاشة) في الحالتين. */
export const textStart: TextStyle["textAlign"] = I18nManager.isRTL
  ? "left"
  : "right";

export const rtlText: TextStyle = {
  writingDirection: "rtl",
  textAlign: textStart,
};
