import type { Metadata } from "next";

import { DashboardScreen } from "@/features/dashboard/components/dashboardScreen";

export const metadata: Metadata = { title: "الرئيسية" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
