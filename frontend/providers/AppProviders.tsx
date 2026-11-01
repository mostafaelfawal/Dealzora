"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { DirectionProvider } from "@base-ui/react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      richColors
      dir="rtl"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider direction="rtl">
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <ThemedToaster />
      </ThemeProvider>
    </DirectionProvider>
  );
}
