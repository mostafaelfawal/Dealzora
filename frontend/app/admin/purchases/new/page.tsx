import type { Metadata } from "next";

import { PurchaseFormScreen } from "@/features/purchases/components/purchaseFormScreen";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "فاتورة شراء جديدة" };

export default function NewPurchasePage() {
  return (
    <PlanGate feature="suppliers">
      <PurchaseFormScreen />
    </PlanGate>
  );
}
