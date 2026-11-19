"use client";

import { isManagement } from "@/config/roles";
import { useSessionUser } from "@/hooks/useShellData";
import { cn } from "@/lib/utils";

import { usePlansSummary } from "../hooks/useInstallments";

/** تذكير بالمتأخرات: عدد الخطط المتأخرة بجانب «التقسيط» في القائمة الجانبية. */
export function InstallmentsNavBadge({ collapsed }: { collapsed: boolean }) {
  const enabled = isManagement(useSessionUser().role);
  const count = usePlansSummary({ enabled }).data?.overduePlans ?? 0;
  if (!enabled || count <= 0) return null;

  const label = count === 1 ? "خطة متأخرة" : `${count} خطط متأخرة`;
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "flex min-w-5 items-center justify-center bg-destructive px-1 font-mono text-[11px] leading-5 text-white tabular-nums",
        collapsed
          ? "absolute top-1 inset-e-1 min-w-4 text-[10px] leading-4"
          : "ms-auto",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
