"use client";

import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemedToaster from "./ThemedToaster";
import { StoreProvider } from "./StoreProvider";
import { QueryProvider } from "./QueryProvider";
import { MotionProvider } from "@/components/shared/motion";
import { FileDropGuard } from "./FileDropGuard";

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
          <StoreProvider>
            <TooltipProvider delay={200}>
              <MotionProvider>{children}</MotionProvider>
            </TooltipProvider>
          </StoreProvider>
        </QueryProvider>
        <ThemedToaster />
        <FileDropGuard />
      </ThemeProvider>
    </DirectionProvider>
  );
}
