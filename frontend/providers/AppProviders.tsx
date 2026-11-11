"use client";

import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemedToaster from "./ThemedToaster";
import { StoreProvider } from "./StoreProvider";
import { QueryProvider } from "./QueryProvider";
import { MotionProvider } from "@/components/shared/motion";
import { FileDropGuard } from "./FileDropGuard";
import { DeviceRuntime } from "@/features/devices/components/deviceRuntime";
import { CurrencySync } from "./CurrencySync";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider direction="rtl">
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          <CurrencySync />
          <StoreProvider>
            <TooltipProvider delay={200}>
              <MotionProvider>{children}</MotionProvider>
            </TooltipProvider>
          </StoreProvider>
        </QueryProvider>
        <ThemedToaster />
        {/* الجهاز الأساسي: تجديد ترخيص أجهزة الكاشير. جهاز الكاشير: حالة الاتصال. */}
        <DeviceRuntime />
        <FileDropGuard />
      </ThemeProvider>
    </DirectionProvider>
  );
}
