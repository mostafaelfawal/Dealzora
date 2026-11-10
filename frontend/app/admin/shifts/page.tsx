import type { Metadata } from "next";

import { ShiftsScreen } from "@/features/shifts/components/shiftsScreen";

export const metadata: Metadata = { title: "الورديات" };

export default function ShiftsPage() {
  return <ShiftsScreen />;
}
