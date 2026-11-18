import type { Metadata } from "next";
import { Suspense } from "react";

import { PlanGate } from "@/components/shared/PlanGate";
import { StoreScreen } from "@/features/onlineStore/components/storeScreen";

export const metadata: Metadata = { title: "المتجر الإلكتروني" };

export default function OnlineStorePage() {
  // useSearchParams (?tab=) يحتاج Suspense في التصدير الثابت.
  return (
    <PlanGate feature="online_store">
      <Suspense>
        <StoreScreen />
      </Suspense>
    </PlanGate>
  );
}
