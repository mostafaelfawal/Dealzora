import { AuthGuard } from "@/features/auth/components/authGuard";
import { PosScreen } from "@/features/pos/components/posScreen";
import { PageEnter } from "@/components/shared/PageEnter";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "الكاشير" };

/** شاشة الكاشير: fullscreen بدون sidebar، خارج app/main. */
export default function PosPage() {
  return (
    <AuthGuard role={["cashier", "manager", "owner"]}>
      <PageEnter>
        <PosScreen />
      </PageEnter>
    </AuthGuard>
  );
}
