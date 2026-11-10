import type { LicenseStatus } from "@/features/setup/types/setup";

const MB = 1_048_576;

/** حجم ملف مقروء: "1.4 MB" أو "320 KB" (أقل شيء 1 KB). */
export const formatFileSize = (bytes: number) =>
  bytes > MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const isLicenseActive = (l: LicenseStatus) =>
  l.state === "trial" || l.state === "licensed";

export function licenseKindLabel(l: LicenseStatus) {
  if (l.kind === "trial") return "تجربة مجانية";
  if (l.kind === "licensed") return "اشتراك مفعّل";
  return "غير مفعّل";
}
