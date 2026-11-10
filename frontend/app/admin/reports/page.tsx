import type { Metadata } from "next";

import { ReportsScreen } from "@/features/reports/components/reportsScreen";

export const metadata: Metadata = { title: "التقارير" };

export default function ReportsPage() {
  return <ReportsScreen />;
}
