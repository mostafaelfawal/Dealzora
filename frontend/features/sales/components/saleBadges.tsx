import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { PAYMENT_LABEL } from "../config/saleOptions";
import type { Sale } from "../types/sale";

/** طريقة الدفع + حالة المرتجع (نص وليس لوناً فقط). */
export function SaleBadges({ sale }: { sale: Sale }) {
  const fullyReturned =
    sale.returnedTotal > 0 && sale.returnedTotal >= sale.total;
  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          "font-normal",
          sale.paymentMethod === "cash"
            ? "border-success/50 text-success"
            : sale.walletAmount > 0
              ? "border-primary/50 text-primary"
              : "border-warning/50 text-warning",
        )}
      >
        {PAYMENT_LABEL[sale.paymentMethod]}
      </Badge>
      {sale.returnedTotal > 0 && (
        <Badge variant="secondary" className="font-normal">
          {fullyReturned ? "مُرجعة بالكامل" : "مرتجع جزئي"}
        </Badge>
      )}
    </>
  );
}
