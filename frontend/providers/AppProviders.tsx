"use client";

import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemedToaster from "./ThemedToaster";
import { StoreProvider } from "./StoreProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider direction="rtl">
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <StoreProvider>
          <TooltipProvider delay={200}>{children}</TooltipProvider>
        </StoreProvider>
        <ThemedToaster />
      </ThemeProvider>
    </DirectionProvider>
  );
}
