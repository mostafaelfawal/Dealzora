import type { Metadata } from "next";

import { InventoryScreen } from "@/features/inventory/components/inventoryScreen";

export const metadata: Metadata = { title: "المخزون" };

export default function InventoryPage() {
  return <InventoryScreen />;
}
