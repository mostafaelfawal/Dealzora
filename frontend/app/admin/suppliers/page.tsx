import { SuppliersScreen } from "@/features/suppliers/components/suppliersScreen";
import { PlanGate } from "@/components/shared/PlanGate";

export default function SuppliersPage() {
  return (
    <PlanGate feature="suppliers">
      <SuppliersScreen />
    </PlanGate>
  );
}
