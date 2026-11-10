"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatDaysArabic } from "@/lib/format";

import { useLicense } from "../hooks/useSettings";
import { isLicenseActive, licenseKindLabel } from "../lib/settingsFormat";

export function LicenseSection() {
  const license = useLicense();
  const l = license.data;

  if (license.isPending) {
    return <p className="text-xs text-muted-foreground">جارٍ التحقق…</p>;
  }
  if (!l) {
    return (
      <p className="text-xs text-muted-foreground">
        بيانات الترخيص متاحة في نسخة سطح المكتب فقط.
      </p>
    );
  }

  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="flex items-center gap-2">
        <dt className="text-muted-foreground">الحالة</dt>
        <dd>
          <Badge
            variant="outline"
            className={
              isLicenseActive(l)
                ? "border-success/50 text-success"
                : "border-destructive/50 text-destructive"
            }
          >
            {licenseKindLabel(l)}
          </Badge>
        </dd>
      </div>
      {l.days_left !== null && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground">المتبقي</dt>
          <dd className="font-medium">
            {l.days_left > 0 ? formatDaysArabic(l.days_left) : "منتهي"}
          </dd>
        </div>
      )}
      {l.expires_at && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground">ينتهي في</dt>
          <dd>{formatDate(l.expires_at * 1000)}</dd>
        </div>
      )}
      <div className="flex min-w-0 gap-2 sm:col-span-2">
        <dt className="shrink-0 text-muted-foreground">رقم الجهاز</dt>
        <dd dir="ltr" className="truncate font-mono select-all">
          {l.machine_id}
        </dd>
      </div>
      <p className="text-muted-foreground sm:col-span-2">
        للتجديد أرسل رقم الجهاز لفريق Dealzora لتحصل على مفتاح التفعيل.
      </p>
    </dl>
  );
}
