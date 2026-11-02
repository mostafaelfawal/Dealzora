"use client";

import {
  IconAlertTriangle,
  IconBuildingWarehouse,
  IconInfoCircle,
  IconPackage,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import type { ProductsSummary, StockFilter } from "../types/product";

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

/** أرقام سريعة، والضغط على "ناقصة" أو "نافدة" يفلتر القائمة فوراً. */
export function ProductsStats({
  summary,
  stock,
  onStockChange,
}: {
  summary: ProductsSummary;
  stock: StockFilter;
  onStockChange: (next: StockFilter) => void;
}) {
  const toggle = (target: StockFilter) =>
    onStockChange(stock === target ? "all" : target);

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat
        icon={<IconPackage />}
        label="إجمالي الأصناف"
        active={stock === "all"}
        onClick={() => onStockChange("all")}
      >
        <bdi dir="ltr" className="font-mono tabular-nums">
          {summary.total}
        </bdi>
      </Stat>
      <Stat icon={<IconBuildingWarehouse />} label="قيمة المخزون (بسعر الشراء)">
        {summary.stockValue === null ? (
          "—"
        ) : (
          <Money amount={summary.stockValue} className="text-lg" />
        )}
      </Stat>
      <Stat
        icon={<IconAlertTriangle />}
        label="أصناف ناقصة"
        active={stock === "low"}
        onClick={() => toggle("low")}
      >
        <bdi dir="ltr" className="font-mono tabular-nums">
          {summary.low}
        </bdi>
      </Stat>
      <Stat
        icon={<IconInfoCircle />}
        label="أصناف نافدة"
        active={stock === "out"}
        onClick={() => toggle("out")}
      >
        <bdi dir="ltr" className="font-mono tabular-nums">
          {summary.out}
        </bdi>
      </Stat>
    </div>
  );
}
