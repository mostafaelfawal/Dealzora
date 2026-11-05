import { TreasuryScreen } from "@/features/treasury/components/treasuryScreen";
import { Metadata } from "next";

export const metadata: Metadata = { title: "الخزينه" };

export default function TreasuryPage() {
  return <TreasuryScreen />;
}
