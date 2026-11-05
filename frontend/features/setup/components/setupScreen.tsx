"use client";

import { IconLoader2 } from "@tabler/icons-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";

import { useSetupGate } from "../hooks/useSetupGate";
import { SetupForm } from "./setupForm";
import { SetupShowcase } from "./setupShowcase";

export function SetupScreen() {
  const ready = useSetupGate("setup");

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="flex flex-col items-center justify-center gap-6 overflow-y-auto p-6 lg:p-12">
        {/* الشعار يظهر هنا على الشاشات الصغيرة فقط */}
        <div className="flex items-center gap-3 lg:hidden">
          <BrandLogo variant="icon" className="h-10" />
          <span className="text-2xl font-bold tracking-tight">
            {BRAND.name}
          </span>
        </div>

        <div className="w-full max-w-sm">
          {ready ? (
            <SetupForm />
          ) : (
            <div
              className="flex justify-center p-10 text-muted-foreground"
              role="status"
              aria-label="جارٍ التحميل"
            >
              <IconLoader2 className="size-6 animate-spin" />
            </div>
          )}
        </div>
      </section>

      <SetupShowcase />
    </main>
  );
}
