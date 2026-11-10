"use client";

import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** فرق جرد الدرج: مطابق / زيادة / عجز. */
export function ShiftDifference({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0) {
    return (
      <Badge
        variant="outline"
        className="border-success/50 font-normal text-success"
      >
        مطابق
      </Badge>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 text-xs",
        value > 0 ? "text-warning" : "text-destructive",
      )}
    >
      {value > 0 ? "زيادة" : "عجز"}
      <Money amount={Math.abs(value)} className="text-xs" />
    </span>
  );
}
