import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { TransfersScreen } from "@/features/branchTransfers/components/transfersScreen";

export const metadata: Metadata = { title: "تحويلات الفروع" };

export default function TransfersPage() {
  return (
    <PlanGate feature="branches">
      <TransfersScreen />
    </PlanGate>
  );
}
