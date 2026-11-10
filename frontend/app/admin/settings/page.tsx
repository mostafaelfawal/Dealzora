import type { Metadata } from "next";

import { SettingsScreen } from "@/features/settings/components/settingsScreen";

export const metadata: Metadata = { title: "الإعدادات" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
