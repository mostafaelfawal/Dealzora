import { cn } from "cn";

import { PosCartHeader } from "./posCartHeader";
import { PosCartTable } from "./posCartTable";
import { PosTotals } from "./posTotals";

/** العمود الثاني: الفاتورة (جدول) + الإجمالي والدفع. */
export function PosCartPanel({ className }: { className?: string }) {
  return (
    <section
      aria-label="الفاتورة"
      className={cn("min-h-0 flex-col bg-background", className)}
    >
      <PosCartHeader />
      <PosCartTable />
      <PosTotals />
    </section>
  );
}
