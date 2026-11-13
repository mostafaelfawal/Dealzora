"use client";

import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconMinus,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import {
  Sparkline,
  type SparkPoint,
} from "@/components/shared/charts/MiscCharts";
import { listItem, MotionDiv } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

import { changePct } from "../lib/insights";

/**
 * رقم رئيسي + مقارنة بالفترة السابقة + خط اتجاه صغير.
 * inverse: الزيادة سيئة (المصروفات، المرتجعات) فيتبدل لون الحالة.
 * التغيّر مكتوب بالنص والسهم، واللون مساعد فقط.
 */
export function KpiCard({
  label,
  children,
  current,
  previous,
  inverse = false,
  spark,
  hint,
  index,
  icon,
}: {
  label: string;
  children: ReactNode;
  current: number;
  previous: number;
  inverse?: boolean;
  /** خط الاتجاه اليومي + شرح يظهر في التلميح عند المرور عليه. */
  spark?: { points: SparkPoint[]; note: string; kind?: "money" | "count" };
  hint?: ReactNode;
  index: number;
  icon: ReactNode;
}) {
  const pct = changePct(current, previous);
  const up = pct !== null && pct > 0;
  const flat = pct === null || pct === 0;
  const good = flat ? null : inverse ? !up : up;

  return (
    <MotionDiv
      {...listItem(index)}
      className="flex min-w-0 flex-col gap-2 border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-4">
          {icon}
          {label}
        </span>
        <AppTooltip message="مقارنة بالفترة السابقة بنفس الطول">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium",
              good === null
                ? "text-muted-foreground"
                : good
                  ? "text-success"
                  : "text-destructive",
            )}
          >
            {flat ? (
              <IconMinus className="size-3" />
            ) : up ? (
              <IconArrowUpRight className="size-3" />
            ) : (
              <IconArrowDownRight className="size-3" />
            )}
            {pct === null ? "جديد" : `${Math.abs(pct)}%`}
          </span>
        </AppTooltip>
      </div>
      <div className="text-xl leading-none font-semibold">{children}</div>
      {spark && (
        <Sparkline
          points={spark.points}
          seriesLabel={label}
          note={spark.note}
          kind={spark.kind}
        />
      )}
      {hint && (
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      )}
    </MotionDiv>
  );
}
