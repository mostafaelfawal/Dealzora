"use client";

import {
  IconAlertTriangle,
  IconCash,
  IconClock,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import type { CustomerFilter, CustomersSummary } from "../types/customer";

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

const Count = ({ value }: { value: number }) => (
  <bdi dir="ltr" className="font-mono tabular-nums">
    {value}
  </bdi>
);

/** أرقام سريعة. الضغط على أي بطاقة يفلتر القائمة، وإعادة الضغط تلغي الفلتر. */
export function CustomersStats({
  summary,
  filter,
  onFilterChange,
}: {
  summary: CustomersSummary;
  filter: CustomerFilter;
  onFilterChange: (next: CustomerFilter) => void;
}) {
  const toggle = (target: CustomerFilter) =>
    onFilterChange(filter === target ? "all" : target);

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat
        icon={<IconUsers />}
        label="إجمالي العملاء"
        active={filter === "all"}
        onClick={() => onFilterChange("all")}
      >
        <Count value={summary.total} />
      </Stat>
      <Stat
        icon={<IconCash />}
        label={`مديونيات العملاء (${summary.debtors})`}
        active={filter === "debtors"}
        onClick={() => toggle("debtors")}
      >
        <Money amount={summary.totalDebt} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconClock />}
        label="متأخرون في السداد"
        active={filter === "overdue"}
        onClick={() => toggle("overdue")}
      >
        <Count value={summary.overdue} />
      </Stat>
      <Stat
        icon={<IconAlertTriangle />}
        label="بلغوا الحد الائتماني"
        active={filter === "limit"}
        onClick={() => toggle("limit")}
      >
        <Count value={summary.atLimit} />
      </Stat>
    </div>
  );
}
