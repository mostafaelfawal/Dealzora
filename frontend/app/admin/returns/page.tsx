import type { Metadata } from "next";

import { ReturnsScreen } from "@/features/sales/components/returnsScreen";

export const metadata: Metadata = { title: "المرتجعات" };

export default function ReturnsPage() {
  return <ReturnsScreen />;
}
