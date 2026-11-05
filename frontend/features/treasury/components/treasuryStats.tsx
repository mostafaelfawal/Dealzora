"use client";

import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCalendarMonth,
  IconWallet,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { round2 } from "@/features/pos/lib/posCalc";
import { cn } from "@/lib/utils";

import type { TreasuryFilters, TreasurySummary } from "../types/treasury";

interface StatProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}

/** بطاقة إحصائية تعمل كفلتر سريع. */
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

/** أرقام سريعة. الضغط على بطاقة يفلتر القائمة، وإعادة الضغط تلغي الفلتر. */
export function TreasuryStats({
  summary,
  filters,
  onChange,
}: {
  summary: TreasurySummary;
  filters: TreasuryFilters;
  onChange: (partial: Partial<TreasuryFilters>) => void;
}) {
  const { direction, kind, period } = filters;
  const reset = { direction: "all", kind: "all", period: "all" } as const;
  const netMonth = round2(summary.monthIn - summary.monthOut);

  const todayIn = direction === "in" && period === "today";
  const todayOut = direction === "out" && period === "today";
  const month = direction === "all" && period === "month";

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat
        icon={<IconWallet />}
        label="رصيد الخزنة الآن"
        active={direction === "all" && kind === "all" && period === "all"}
        onClick={() => onChange(reset)}
      >
        <Money
          amount={summary.balance}
          className={cn("text-lg", summary.balance < 0 && "text-destructive")}
        />
      </Stat>
      <Stat
        icon={<IconArrowDownLeft />}
        label="داخل اليوم"
        active={todayIn}
        onClick={() =>
          onChange(
            todayIn ? reset : { direction: "in", kind: "all", period: "today" },
          )
        }
      >
        <Money amount={summary.todayIn} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconArrowUpRight />}
        label="خارج اليوم"
        active={todayOut}
        onClick={() =>
          onChange(
            todayOut
              ? reset
              : { direction: "out", kind: "all", period: "today" },
          )
        }
      >
        <Money amount={summary.todayOut} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconCalendarMonth />}
        label="صافي هذا الشهر"
        active={month}
        onClick={() =>
          onChange(
            month ? reset : { direction: "all", kind: "all", period: "month" },
          )
        }
      >
        <Money
          amount={netMonth}
          className={cn("text-lg", netMonth < 0 && "text-destructive")}
        />
      </Stat>
    </div>
  );
}
