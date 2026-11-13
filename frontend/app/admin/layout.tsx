import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/features/auth/components/authGuard";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard role={["owner", "manager"]}>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
