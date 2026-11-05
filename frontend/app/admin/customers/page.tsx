import { CustomersScreen } from "@/features/customers/components/customersScreen";
import { Metadata } from "next";

export const metadata: Metadata = { title: "العملاء" };

export default function CustomersPage() {
  return <CustomersScreen />;
}
