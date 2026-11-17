/**
 * بيانات الملخص من نفس مسارات الهاتف الحالية (لا مسار جديد في الخادم): الملخص + الأكثر مبيعاً +
 * العمليات الحساسة + الورديات. الشرائح تُبنى **مرة واحدة** بعد وصول كل شيء، فالتحديث التلقائي
 * أثناء المشاهدة لا يغيّر عدد الشرائح تحت إصبع المستخدم.
 */
import { useState } from "react";

import { errorMessage } from "@/api/errors";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSummary } from "@/features/dashboard/hooks/useSummary";
import {
  useSensitive,
  useShifts,
  useTopSellers,
} from "@/features/reports/hooks/useReports";

import {
  buildRecap,
  periodLabel,
  recapRange,
  type RecapPeriod,
  type Slide,
} from "../lib/recap";

interface Q {
  data?: unknown;
  isError: boolean;
  isPlaceholderData: boolean;
}

/** وصل لهذه الفترة بالذات (لا بيانات فترة سابقة معروضة مؤقتاً)، أو فشل. */
const settled = (q: Q) =>
  (q.data !== undefined && !q.isPlaceholderData) || q.isError;
const fresh = <T>(q: { data?: T; isPlaceholderData: boolean }) =>
  q.isPlaceholderData ? undefined : q.data;

export function useRecap(period: RecapPeriod, date: string) {
  const { user } = useAuth();
  const range = recapRange(period, date);
  const summary = useSummary(range);
  const top = useTopSellers(range);
  const sensitive = useSensitive(range);
  const shifts = useShifts(range);

  const shop = user?.shop_name ?? "متجرك";
  const intro: Slide = {
    kind: "intro",
    shop,
    periodLabel: periodLabel(period, date),
    period,
  };

  const [slides, setSlides] = useState<Slide[] | null>(null);
  const summaryData = fresh(summary);
  const ready =
    summaryData !== undefined &&
    settled(top) &&
    settled(sensitive) &&
    settled(shifts);
  // بناء مرة واحدة أثناء الـ render (نمط React الموصى به بدل effect).
  if (slides === null && ready)
    setSlides(
      buildRecap({
        period,
        date,
        shopName: shop,
        summary: summaryData,
        top: fresh(top),
        sensitive: fresh(sensitive),
        shifts: fresh(shifts),
      }),
    );

  return {
    slides: slides ?? [intro],
    loading: slides === null,
    error:
      summary.isError && summaryData === undefined
        ? errorMessage(summary.error)
        : null,
    retry: () => void summary.refetch(),
  };
}
