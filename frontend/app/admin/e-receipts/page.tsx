import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { EReceiptsScreen } from "@/features/eta/components/eReceiptsScreen";

export const metadata: Metadata = { title: "الإيصالات الإلكترونية" };

export default function EReceiptsPage() {
  return (
    <PlanGate feature="e_receipt">
      <EReceiptsScreen />
    </PlanGate>
  );
}
