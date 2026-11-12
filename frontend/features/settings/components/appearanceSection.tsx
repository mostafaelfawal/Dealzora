"use client";

import {
  IconBolt,
  IconDeviceDesktop,
  IconDeviceDesktopAnalytics,
  IconMoon,
  IconSparkles,
  IconSun,
  type Icon,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  setMotionPreference,
  useMotionPreference,
  type HardwareInfo,
  type MotionPreference,
} from "@/lib/motionPreference";
import { cn } from "@/lib/utils";

const MOTION: { value: MotionPreference; label: string; icon: Icon }[] = [
  { value: "auto", label: "حسب الجهاز", icon: IconDeviceDesktopAnalytics },
  { value: "on", label: "تشغيل", icon: IconSparkles },
  { value: "off", label: "إيقاف (أسرع)", icon: IconBolt },
];

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

      <MotionSetting mounted={mounted} />
    </div>
  );
}

function specsText(hw: HardwareInfo): string {
  const cores = `${hw.cpu_cores} ${hw.cpu_cores <= 10 ? "أنوية" : "نواة"}`;
  if (hw.total_memory_mb === null) return cores;
  const gb = Math.round((hw.total_memory_mb / 1024) * 10) / 10;
  return `${cores}، ${gb} جيجا رام`;
}

/** الحركة والتأثيرات: تُوقف تلقائياً على الأجهزة الضعيفة (فحص Rust). */
function MotionSetting({ mounted }: { mounted: boolean }) {
  const { preference, reduced, hardware } = useMotionPreference();
  const current = mounted ? preference : null;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-xs font-medium">الحركة والتأثيرات</p>
      <div
        role="radiogroup"
        aria-label="الحركة والتأثيرات"
        className="grid grid-cols-3 gap-2"
      >
        {MOTION.map(({ value, label, icon: Icon }) => {
          const active = current === value;
          return (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              variant="outline"
              onClick={() => setMotionPreference(value)}
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
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {!mounted
          ? " "
          : preference !== "auto"
            ? reduced
              ? "الحركة متوقفة على هذا الجهاز."
              : "الحركة تعمل على هذا الجهاز."
            : hardware
              ? `هذا الجهاز: ${specsText(hardware)} — ${
                  hardware.low_end
                    ? "جهاز خفيف، أوقفنا الحركة ليبقى البرنامج سريعاً."
                    : "الجهاز قوي بما يكفي، الحركة تعمل."
                }`
              : "جارٍ فحص مواصفات الجهاز…"}
      </p>
    </div>
  );
}
