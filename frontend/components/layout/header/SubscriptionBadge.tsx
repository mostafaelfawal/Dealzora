import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDaysArabic } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Subscription } from "@/types/shell";

/** عدد الأيام اللي قبلها يبدأ التنبيه. */
const WARNING_THRESHOLD_DAYS = 7;
const CRITICAL_THRESHOLD_DAYS = 2;

interface SubscriptionBadgeProps {
  subscription: Subscription;
}

/** مبيظهرش غير قبل انتهاء الاشتراك بفترة، عشان الـ Header يفضل هادي. */
export function SubscriptionBadge({ subscription }: SubscriptionBadgeProps) {
  const { daysRemaining } = subscription;
  if (daysRemaining > WARNING_THRESHOLD_DAYS) return null;

  const critical = daysRemaining <= CRITICAL_THRESHOLD_DAYS;

  const shortText =
    daysRemaining <= 0
      ? "انتهى الاشتراك"
      : `ينتهي بعد ${formatDaysArabic(daysRemaining)}`;
  const fullText =
    daysRemaining <= 0
      ? "انتهى الاشتراك — تعمل على «بَسطة». جدّد الآن"
      : `الاشتراك ينتهي بعد ${formatDaysArabic(daysRemaining)}`;

  return (
    <Badge
      variant="outline"
      render={<Link href="/admin/settings#plans" />}
      className={cn(
        "h-7 px-2.5 font-normal",
        critical
          ? "border-destructive/40 text-destructive"
          : "border-warning/50 text-warning",
      )}
    >
      <span className="xl:hidden">{shortText}</span>
      <span className="hidden xl:inline">{fullText}</span>
    </Badge>
  );
}
