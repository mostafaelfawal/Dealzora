"use client";

import {
  IconBuildingStore,
  IconCash,
  IconClockExclamation,
  IconEyeOff,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import type { BalanceFilter, SuppliersSummary } from "../types/supplier";

interface StatProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

/** بطاقة إحصائية. لو لها onClick تعمل كفلتر سريع، وإلا تكون للعرض فقط. */
function Stat({ icon, label, children, active, onClick }: StatProps) {
  const className = cn(
    "flex items-center gap-3 border bg-card p-3 text-start outline-none transition-[border-color,transform] duration-150",
    onClick &&
      "cursor-pointer hover:border-primary/60 active:scale-[0.98] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
    active && "border-primary",
  );
  const body = (
    <>
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
    </>
  );

  return onClick ? (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={className}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** أرقام سريعة، والضغط على "عليهم مستحقات" يفلتر القائمة فوراً. */
export function SuppliersStats({
  summary,
  balance,
  onBalanceChange,
}: {
  summary: SuppliersSummary;
  balance: BalanceFilter;
  onBalanceChange: (next: BalanceFilter) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat
        icon={<IconBuildingStore />}
        label="إجمالي الموردين"
        active={balance === "all"}
        onClick={() => onBalanceChange("all")}
      >
        <bdi dir="ltr" className="font-mono tabular-nums">
          {summary.total}
        </bdi>
      </Stat>
      <Stat icon={<IconCash />} label="إجمالي المستحقات للموردين">
        <Money amount={summary.totalPayable} className="text-lg" />
      </Stat>
      <Stat
        icon={<IconClockExclamation />}
        label="موردون لهم مستحقات"
        active={balance === "owed"}
        onClick={() => onBalanceChange(balance === "owed" ? "all" : "owed")}
      >
        <bdi dir="ltr" className="font-mono tabular-nums">
          {summary.owed}
        </bdi>
      </Stat>
      <Stat icon={<IconEyeOff />} label="موردون معطّلون">
        <bdi dir="ltr" className="font-mono tabular-nums">
          {summary.inactive}
        </bdi>
      </Stat>
    </div>
  );
}
