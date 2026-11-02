import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { formatQty } from "@/lib/format";
import { getStockLevel } from "../lib/posCalc";
import type { PosProduct } from "../types/pos";

/** تنبيه المخزون: يظهر فقط عندما يكون الصنف قليلاً أو نافداً (نص + أيقونة، وليس لوناً وحده). */
export function PosStockBadge({
  product,
}: {
  product: Pick<PosProduct, "stock" | "minStock">;
}) {
  const level = getStockLevel(product);
  if (level === "ok") return null;

  if (level === "out") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 whitespace-nowrap border-destructive/50 text-destructive bg-card"
      >
        <IconInfoCircle />
        نفد
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 whitespace-nowrap border-warning/50 text-warning bg-card"
    >
      <IconAlertTriangle />
      باقي {formatQty(product.stock)}
    </Badge>
  );
}
