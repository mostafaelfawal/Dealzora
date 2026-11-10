import type { Metadata } from "next";

import { PurchaseFormScreen } from "@/features/purchases/components/purchaseFormScreen";

export const metadata: Metadata = { title: "فاتورة شراء جديدة" };

export default function NewPurchasePage() {
  return <PurchaseFormScreen />;
}
