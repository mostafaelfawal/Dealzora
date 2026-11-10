"use client";

import {
  IconCashRegister,
  IconShieldCheck,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { UserFilters, UsersSummary } from "../types/user";

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

/** أرقام سريعة، والضغط على أي بطاقة يفلتر القائمة فوراً (والضغط ثانية يلغي الفلتر). */
export function UsersStats({
  summary,
  filters,
  onChange,
}: {
  summary: UsersSummary;
  filters: UserFilters;
  onChange: (partial: Partial<UserFilters>) => void;
}) {
  const { role, status } = filters;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat
        icon={<IconUsers />}
        label="إجمالي المستخدمين"
        active={role === "all" && status === "all"}
        onClick={() => onChange({ role: "all", status: "all" })}
      >
        <Count value={summary.total} />
      </Stat>
      <Stat
        icon={<IconCashRegister />}
        label="الكاشير"
        active={role === "cashier"}
        onClick={() =>
          onChange({ role: role === "cashier" ? "all" : "cashier" })
        }
      >
        <Count value={summary.cashiers} />
      </Stat>
      <Stat
        icon={<IconShieldCheck />}
        label="المديرون"
        active={role === "manager"}
        onClick={() =>
          onChange({ role: role === "manager" ? "all" : "manager" })
        }
      >
        <Count value={summary.managers} />
      </Stat>
      <Stat
        icon={<IconUserOff />}
        label="حسابات معطّلة"
        active={status === "inactive"}
        onClick={() =>
          onChange({ status: status === "inactive" ? "all" : "inactive" })
        }
      >
        <Count value={summary.inactive} />
      </Stat>
    </div>
  );
}
