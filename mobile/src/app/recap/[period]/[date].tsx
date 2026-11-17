/** ملخص اليوم/الأسبوع بشرائح: /recap/day/2026-11-17 أو /recap/week/2026-11-20 (من الإشعار أو «المزيد»). */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import { RecapStory } from "@/features/recap/components/RecapStory";
import { useRecap } from "@/features/recap/hooks/useRecap";
import type { RecapPeriod } from "@/features/recap/lib/recap";

const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

export default function RecapRoute() {
  const params = useLocalSearchParams<{ period: string; date: string }>();
  const valid =
    (params.period === "day" || params.period === "week") &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "");

  useEffect(() => {
    if (!valid) close();
  }, [valid]);

  if (!valid) return null;
  return <Recap period={params.period as RecapPeriod} date={params.date} />;
}

function Recap({ period, date }: { period: RecapPeriod; date: string }) {
  const r = useRecap(period, date);
  return (
    <RecapStory
      slides={r.slides}
      loading={r.loading}
      error={r.error}
      onRetry={r.retry}
      onClose={close}
    />
  );
}
