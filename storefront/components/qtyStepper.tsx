"use client";

import { IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";

import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

/** − الكمية + بخطوة الوحدة (قطعة أو ربع كيلو)، والسلة تتحدّث فوراً. */
export function QtyStepper({
  qty,
  step,
  max,
  unit,
  onChange,
  size = "md",
  className,
}: {
  qty: number;
  step: number;
  max: number | null;
  unit: string;
  onChange: (qty: number) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const atMax = max !== null && qty + step > max;
  const h = size === "sm" ? "h-9" : "h-11";
  const btn = cn(
    "flex aspect-square items-center justify-center transition-colors hover:bg-muted active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent",
    h,
  );
  return (
    <div
      className={cn("flex items-stretch border bg-background", h, className)}
      role="group"
      aria-label={`الكمية: ${formatQty(qty)} ${unit}`}
    >
      <button
        type="button"
        className={btn}
        aria-label="زيادة الكمية"
        disabled={atMax}
        onClick={() => onChange(qty + step)}
      >
        <IconPlus className="size-4" />
      </button>
      <span className="flex min-w-12 flex-1 flex-col items-center justify-center border-x px-1 leading-none">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatQty(qty)}
        </span>
        {size === "md" && (
          <span className="mt-0.5 text-[10px] text-muted-foreground">{unit}</span>
        )}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={qty <= step ? "حذف من السلة" : "تقليل الكمية"}
        onClick={() => onChange(qty - step)}
      >
        {qty <= step ? (
          <IconTrash className="size-4 text-destructive" />
        ) : (
          <IconMinus className="size-4" />
        )}
      </button>
    </div>
  );
}
