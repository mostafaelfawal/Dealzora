import { ExpensesScreen } from "@/features/expenses/components/expensesScreen";
import { Metadata } from "next";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "المصروفات" };

export default function ExpensesPage() {
  return (
    <PlanGate feature="expenses">
      <ExpensesScreen />
    </PlanGate>
  );
}
