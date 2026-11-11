import { TreasuryScreen } from "@/features/treasury/components/treasuryScreen";
import { Metadata } from "next";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "الخزينه" };

export default function TreasuryPage() {
  return (
    <PlanGate feature="expenses">
      <TreasuryScreen />
    </PlanGate>
  );
}
