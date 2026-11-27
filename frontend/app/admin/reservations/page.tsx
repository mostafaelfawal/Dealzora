import type { Metadata } from "next";

import { PlanGate } from "@/components/shared/PlanGate";
import { ReservationsScreen } from "@/features/reservations/components/reservationsScreen";

export const metadata: Metadata = { title: "الحجوزات" };

export default function ReservationsPage() {
  return (
    <PlanGate feature="customers">
      <ReservationsScreen />
    </PlanGate>
  );
}
