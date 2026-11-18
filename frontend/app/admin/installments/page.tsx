import type { Metadata } from "next";
import { Suspense } from "react";

import { PlanGate } from "@/components/shared/PlanGate";
import { InstallmentsScreen } from "@/features/installments/components/installmentsScreen";

export const metadata: Metadata = { title: "التقسيط" };

export default function InstallmentsPage() {
  // useSearchParams (?q= من صفحة العملاء) يحتاج Suspense في التصدير الثابت.
  return (
    <PlanGate feature="installments">
      <Suspense>
        <InstallmentsScreen />
      </Suspense>
    </PlanGate>
  );
}
