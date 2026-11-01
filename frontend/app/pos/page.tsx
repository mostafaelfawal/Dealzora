import { PosScreen } from "@/features/pos/components/posScreen";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "الكاشير" };

/** شاشة الكاشير: fullscreen بدون sidebar، خارج app/main. */
export default function PosPage() {
  return <PosScreen />;
}
