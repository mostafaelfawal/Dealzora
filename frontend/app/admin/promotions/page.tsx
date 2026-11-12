import type { Metadata } from "next";

import { PromotionsScreen } from "@/features/promotions/components/promotionsScreen";

export const metadata: Metadata = { title: "العروض" };

export default function PromotionsPage() {
  return <PromotionsScreen />;
}
