import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { PurchaseOrdersScreen } from "@/features/purchaseOrders/components/purchaseOrdersScreen";

export const metadata: Metadata = { title: "طلبات الشراء" };

export default function PurchaseOrdersPage() {
  return (
    <PlanGate feature="purchase_orders">
      <PurchaseOrdersScreen />
    </PlanGate>
  );
}
