import { ExpensesScreen } from "@/features/expenses/components/expensesScreen";
import { Metadata } from "next";

export const metadata: Metadata = { title: "المصروفات" };

export default function ExpensesPage() {
  return <ExpensesScreen />;
}
