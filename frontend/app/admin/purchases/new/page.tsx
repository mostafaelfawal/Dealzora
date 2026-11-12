import type { Metadata } from "next";
import { Suspense } from "react";

import { PurchaseFormScreen } from "@/features/purchases/components/purchaseFormScreen";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "فاتورة شراء جديدة" };

export default function NewPurchasePage() {
  return (
    <PlanGate feature="suppliers">
      <Suspense>
        <PurchaseFormScreen />
      </Suspense>
    </PlanGate>
  );
}
