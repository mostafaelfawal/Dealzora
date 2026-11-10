"use client";

import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  type Icon,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THEMES: { value: string; label: string; icon: Icon }[] = [
  { value: "system", label: "حسب الجهاز", icon: IconDeviceDesktop },
  { value: "light", label: "فاتح", icon: IconSun },
  { value: "dark", label: "داكن", icon: IconMoon },
];

// الثيم يُقرأ من المتصفح بعد التحميل فقط (تفادي hydration mismatch).
const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/**
 * المظهر تفضيل شخصي لكل جهاز/مستخدم، فيُحفظ في المتصفح (next-themes → localStorage)
 * وليس في القاعدة مثل باقي الإعدادات العامة.
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? "system") : null;

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="مظهر البرنامج"
        className="grid grid-cols-3 gap-2"
      >
        {THEMES.map(({ value, label, icon: Icon }) => {
          const active = current === value;
          return (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              variant="outline"
              onClick={() => setTheme(value)}
              className={cn(
                "h-auto flex-col gap-1.5 py-3 font-normal",
                active && "border-primary bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        يُحفظ على هذا الجهاز فقط، فكل مستخدم يختار ما يريحه.
      </p>
    </div>
  );
}
