import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { calcMargin } from "../lib/productCalc";

/** هامش الربح بلون يوضح الحالة (خسارة / ضعيف / جيد) مع نص، وليس لوناً وحده. */
export function ProductMarginBadge({
  cost,
  sale,
  className,
}: {
  cost: number;
  sale: number;
  className?: string;
}) {
  const margin = calcMargin(cost, sale);
  if (!margin) return null;

  const tone =
    margin.percent < 0
      ? "border-destructive/50 text-destructive"
      : margin.percent < 10
        ? "border-warning/50 text-warning"
        : "border-success/50 text-success";

  return (
    <Badge variant="outline" className={cn("font-normal", tone, className)}>
      هامش{" "}
      <bdi dir="ltr" className="font-mono">
        {margin.percent}%
      </bdi>
    </Badge>
  );
}
