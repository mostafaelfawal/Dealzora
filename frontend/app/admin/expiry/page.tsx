import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { ExpiryScreen } from "@/features/expiry/components/expiryScreen";

export const metadata: Metadata = { title: "الصلاحية" };

export default function ExpiryPage() {
  return (
    <PlanGate feature="expiry">
      <ExpiryScreen />
    </PlanGate>
  );
}
