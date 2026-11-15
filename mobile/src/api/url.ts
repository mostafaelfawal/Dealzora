/** عنوان خادم المزامنة: تطبيع ما يكتبه المستخدم (بدون / في الآخر، و https افتراضياً). */

export const MOBILE_PREFIX = "/mobile/v1";

export function normalizeServerUrl(input: string | null | undefined): string | null {
  let value = (input ?? "").trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, "");
  // لو المستخدم لصق العنوان كاملاً بمسار الـ API نشيله.
  value = value.replace(/\/(mobile\/v1|v1)$/i, "");
  try {
    const url = new URL(value);
    if (!url.hostname) return null;
  } catch {
    return null;
  }
  return value;
}

/** http بدون تشفير مسموح فقط لعناوين الشبكة المحلية (تجربة على جهازك). */
export function isInsecureRemote(url: string): boolean {
  if (!/^http:\/\//i.test(url)) return false;
  const host = url.replace(/^http:\/\//i, "").split(/[/:]/)[0] ?? "";
  const local =
    host === "localhost" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  return !local;
}
