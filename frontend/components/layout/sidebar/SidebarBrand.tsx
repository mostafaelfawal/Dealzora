import Link from "next/link";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";
import { PLAN_BADGE_CLASS, PLAN_ICON } from "@/config/planBadges";
import { usePlan } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { AppTooltip } from "@/components/shared/AppTooltip";

interface SidebarBrandProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarBrand({
  collapsed = false,
  onNavigate,
}: SidebarBrandProps) {
  const { data: plan } = usePlan();

  return (
    <AppTooltip
      message={`${BRAND.name} — الرئيسية${plan ? ` · خطة ${plan.name}` : ""}`}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className={cn(
          "flex h-14.25 shrink-0 items-center gap-2 border-b px-4 text-lg font-semibold",
          collapsed && "justify-center px-0",
        )}
      >
        <BrandLogo variant="icon" />
        {!collapsed && (
          <>
            <span>{BRAND.name}</span>
            {plan && <PlanBadge plan={plan.plan} name={plan.name} />}
          </>
        )}
      </Link>
    </AppTooltip>
  );
}

/** شارة الخطة الحالية بأيقونتها ولونها. */
function PlanBadge({
  plan,
  name,
}: {
  plan: keyof typeof PLAN_ICON;
  name: string;
}) {
  const PlanIcon = PLAN_ICON[plan];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[11px] leading-none font-medium",
        PLAN_BADGE_CLASS[plan],
      )}
    >
      <PlanIcon className="size-3.5" stroke={1.75} />
      {name}
    </span>
  );
}
