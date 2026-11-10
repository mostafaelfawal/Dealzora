import type { Metadata } from "next";

import { PurchasesScreen } from "@/features/purchases/components/purchasesScreen";

export const metadata: Metadata = { title: "المشتريات" };

export default function PurchasesPage() {
  return <PurchasesScreen />;
}
