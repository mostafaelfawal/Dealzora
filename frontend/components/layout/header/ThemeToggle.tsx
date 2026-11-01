"use client";

import { IconContrast } from "@tabler/icons-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { AppTooltip } from "@/components/shared/AppTooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <AppTooltip message="تبديل المظهر">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="تبديل المظهر"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <IconContrast className="size-5" />
      </Button>
    </AppTooltip>
  );
}
