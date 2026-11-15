import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";

import { AppText } from "./AppText";

interface Props {
  /** dataUpdatedAt من useQuery (0 = لم تُجلب بعد). */
  at: number;
  /** نص قبل الوقت. */
  label?: string;
}

/** «آخر تحديث: منذ 3 دقائق» لكل بيانات معروضة (قد تكون محفوظة من قبل انقطاع الاتصال). */
export function LastUpdated({ at, label = "آخر تحديث" }: Props) {
  const now = useNow();
  if (!at) return null;
  return (
    <AppText size="xs" tone="muted">
      {label}: {formatTimeAgo(at, now)}
    </AppText>
  );
}
