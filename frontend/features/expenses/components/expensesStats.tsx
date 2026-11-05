"use client";

import {
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarWeek,
  IconReceipt,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import type { ExpensePeriod, ExpensesSummary } from "../types/expense";

interface StatProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}

/** بطاقة إحصائية تعمل كفلتر سريع للفترة. */
function Stat({ icon, label, children, active, onClick }: StatProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 border bg-card p-3 text-start outline-none transition-[border-color,transform] duration-150",
        "hover:border-primary/60 active:scale-[0.98] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        active && "border-primary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground [&_svg]:size-4",
          active && "bg-primary text-primary-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block text-lg leading-none font-semibold">
          {children}
        </span>
      </span>
    </button>
  );
}

/** مصاريف اليوم / 7 أيام / الشهر / الإجمالي. الضغط يفلتر القائمة، وإعادته تلغي الفلتر. */
export function ExpensesStats({
  summary,
  period,
  onPeriodChange,
}: {
  summary: ExpensesSummary;
  period: ExpensePeriod;
  onPeriodChange: (next: ExpensePeriod) => void;
}) {
  const toggle = (target: ExpensePeriod) =>
    onPeriodChange(period === target ? "all" : target);

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat
        icon={<IconCalendarEvent />}
        label="مصاريف اليوم"
        active={period === "today"}
        onClick={() => toggle("today")}
      >
        <Money amount={summary.today} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconCalendarWeek />}
        label="آخر 7 أيام"
        active={period === "week"}
        onClick={() => toggle("week")}
      >
        <Money amount={summary.week} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconCalendarMonth />}
        label="هذا الشهر"
        active={period === "month"}
        onClick={() => toggle("month")}
      >
        <Money amount={summary.month} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconReceipt />}
        label={`إجمالي المصاريف (${summary.count})`}
        active={period === "all"}
        onClick={() => onPeriodChange("all")}
      >
        <Money amount={summary.total} className="text-lg" />
      </Stat>
    </div>
  );
}
