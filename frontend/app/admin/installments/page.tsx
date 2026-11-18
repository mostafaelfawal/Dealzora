import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { InstallmentsScreen } from "@/features/installments/components/installmentsScreen";

export const metadata: Metadata = { title: "التقسيط" };

export default function InstallmentsPage() {
  return (
    <PlanGate feature="installments">
      <InstallmentsScreen />
    </PlanGate>
  );
}
