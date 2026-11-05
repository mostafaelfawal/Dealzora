import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import type { CashDirection } from "../types/treasury";

/** مبلغ الحركة بإشارة ولون: داخل (+ أخضر) / خارج (− أحمر). النص المخفي للقارئ الشاشي. */
export function TreasuryAmount({
  direction,
  amount,
  className,
}: {
  direction: CashDirection;
  amount: number;
  className?: string;
}) {
  const isIn = direction === "in";
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1",
        isIn ? "text-success" : "text-destructive",
      )}
    >
      <span className="sr-only">{isIn ? "داخل" : "خارج"}</span>
      <bdi dir="ltr" aria-hidden className="font-mono">
        {isIn ? "+" : "−"}
      </bdi>
      <Money amount={amount} className={className} />
    </span>
  );
}
