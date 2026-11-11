import { CustomersScreen } from "@/features/customers/components/customersScreen";
import { Metadata } from "next";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "العملاء" };

export default function CustomersPage() {
  return (
    <PlanGate feature="customers">
      <CustomersScreen />
    </PlanGate>
  );
}
