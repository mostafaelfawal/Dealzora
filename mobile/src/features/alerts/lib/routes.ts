/**
 * شاشة التطبيق من رابط التنبيه. الرابط يأتي من الخادم (أو من إشعار push)، فنقبل قائمة شاشات معروفة فقط:
 * رابط غير متوقع لا يفتح أي شيء.
 */
const STATIC = new Set([
  "/alerts", "/receipts", "/transfers", "/branches", "/", "/stock", "/shifts", "/sensitive", "/top-sellers",
]);
const DYNAMIC = /^\/(transfer|branch)\/[0-9A-Za-z-]{8,36}$/;

export function safeRoute(url: unknown): string | null {
  if (typeof url !== "string") return null;
  if (STATIC.has(url) || DYNAMIC.test(url)) return url;
  return null;
}
