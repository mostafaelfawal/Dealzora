import type { Metadata } from "next";

import { PurchasesScreen } from "@/features/purchases/components/purchasesScreen";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "المشتريات" };

export default function PurchasesPage() {
  return (
    <PlanGate feature="suppliers">
      <PurchasesScreen />
    </PlanGate>
  );
}
