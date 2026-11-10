import type { Metadata } from "next";

import { SalesScreen } from "@/features/sales/components/salesScreen";

export const metadata: Metadata = { title: "الفواتير" };

export default function SalesPage() {
  return <SalesScreen />;
}
