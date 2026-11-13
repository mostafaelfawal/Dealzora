"use client";

import { isManagement } from "@/config/roles";
import { IconArrowRight, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fadeUp, MotionDiv } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import { clearSession } from "@/features/auth/lib/authStorage";
import { logout } from "@/features/settings/api/settings.api";
import { OpenShiftForm } from "@/features/shifts/components/openShiftForm";
import { useSessionUser } from "@/hooks/useShellData";

/** لا وردية مفتوحة = لا بيع. نفتحها هنا مباشرة بخطوة واحدة (الفكّة ثم Enter). */
export function PosNoShift() {
  const user = useSessionUser();
  const router = useRouter();

  async function signOut() {
    try {
      await logout();
    } catch {}
    clearSession();
    router.replace(AUTH_ROUTES.login);
  }

  return (
    <main className="flex h-dvh items-start justify-center bg-background p-4 pt-[12dvh]">
      <MotionDiv
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <CardTitle>أهلاً {user.name}، ابدأ ورديتك</CardTitle>
            <CardDescription>
              لا توجد وردية مفتوحة. عدّ الفكّة الموجودة في الدرج واكتبها لتبدأ
              البيع.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OpenShiftForm />
            {isManagement(user.role) ? (
              <Button
                size="lg"
                variant="ghost"
                nativeButton={false}
                render={<Link href="/admin/dashboard" />}
                className="w-full gap-2 font-normal"
              >
                <IconArrowRight className="size-4" />
                رجوع إلى لوحة التحكم
              </Button>
            ) : (
              <Button
                size="lg"
                variant="ghost"
                onClick={() => void signOut()}
                className="w-full gap-2 font-normal"
              >
                <IconLogout className="size-4" />
                تسجيل الخروج
              </Button>
            )}
          </CardContent>
        </Card>
      </MotionDiv>
    </main>
  );
}
