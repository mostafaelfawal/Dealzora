import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportsScreen } from "@/features/reports/components/reportsScreen";

export const metadata: Metadata = { title: "التقارير" };

export default function ReportsPage() {
  // useSearchParams (التقرير المفتوح في الرابط) يحتاج Suspense في التصدير الثابت.
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}
