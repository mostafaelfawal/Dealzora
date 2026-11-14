"use client";

import { IconLoader2 } from "@tabler/icons-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";

import { useSetupGate } from "../hooks/useSetupGate";
import { BackendStartup } from "./backendStartup";
import { DeviceRoleNotice } from "./deviceRoleNotice";
import { SetupForm } from "./setupForm";
import { SetupShowcase } from "./setupShowcase";

export function SetupScreen() {
  const { ready, failed, answered } = useSetupGate("setup");
  if (!answered) return <BackendStartup failed={failed} />;

  // الخادم رد بأن المحل مُعدّ مسبقاً: نوضّح للتاجر ما يحدث بدل مؤشر صامت.
  if (!ready) {
    return (
      <main
        role="status"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
      >
        <IconLoader2 className="size-6 animate-spin" aria-hidden />
        <p className="text-sm">المحل مُعدّ بالفعل، جارٍ فتح تسجيل الدخول…</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh bg-background lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
      <section className="flex flex-col overflow-y-auto px-4 py-8 sm:px-6 lg:px-12">
        <div className="m-auto w-full max-w-md space-y-6">
          {/* الشعار يظهر هنا على الشاشات الصغيرة فقط */}
          <div className="flex items-center justify-center gap-3 lg:hidden">
            <BrandLogo variant="icon" className="h-10" />
            <span className="text-2xl font-bold tracking-tight">
              {BRAND.name}
            </span>
          </div>

          <DeviceRoleNotice />
          <SetupForm />
        </div>
      </section>

      <SetupShowcase />
    </main>
  );
}
