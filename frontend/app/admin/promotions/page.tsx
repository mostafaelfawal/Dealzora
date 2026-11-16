import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { PromotionsScreen } from "@/features/promotions/components/promotionsScreen";

export const metadata: Metadata = { title: "العروض" };

export default function PromotionsPage() {
  return (
    <PlanGate feature="promotions">
      <PromotionsScreen />
    </PlanGate>
  );
}
