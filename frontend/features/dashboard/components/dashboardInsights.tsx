"use client";

import {
  IconAlertTriangle,
  IconBulb,
  IconTrendingUp,
} from "@tabler/icons-react";
import Link from "next/link";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { listItem, MotionLi } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

import { buildInsights, type Insight, type InsightTone } from "../lib/insights";
import type { Overview } from "../types/dashboard";

const TONE_ICON = {
  good: IconTrendingUp,
  bad: IconAlertTriangle,
  info: IconBulb,
} as const;

const TONE_CLASS: Record<InsightTone, string> = {
  good: "text-success",
  bad: "text-destructive",
  info: "text-muted-foreground",
};

function InsightRow({ insight, index }: { insight: Insight; index: number }) {
  const Icon = TONE_ICON[insight.tone];
  const body = (
    <span className="flex items-start gap-2">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", TONE_CLASS[insight.tone])}
      />
      <span>{insight.text}</span>
    </span>
  );

  return (
    <MotionLi {...listItem(index)} className="text-xs leading-relaxed">
      {insight.href ? (
        <Link href={insight.href} className="block hover:underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </MotionLi>
  );
}

/** ملاحظات تلقائية بلغة التاجر مبنية على أرقام الفترة. */
export function DashboardInsights({ o }: { o: Overview }) {
  const insights = buildInsights(o);

  return (
    <ChartCard
      index={2}
      title="ماذا تقول الأرقام؟"
      subtitle="ملاحظات تلقائية من بيانات الفترة"
    >
      {insights.length === 0 ? (
        <ChartEmpty
          text="لا توجد ملاحظات بعد. ستظهر مع زيادة المبيعات."
          height={120}
        />
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <InsightRow key={insight.text} insight={insight} index={i} />
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
