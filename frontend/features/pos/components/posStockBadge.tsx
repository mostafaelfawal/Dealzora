import { IconAlertTriangle } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { formatQty, getStockLevel } from "../lib/posCalc";
import type { PosProduct } from "../types/pos";

/** تنبيه المخزون: بيظهر بس لما الصنف قليل أو خلصان (نص + أيقونة، مش لون وحده). */
export function PosStockBadge({
  product,
}: {
  product: Pick<PosProduct, "stock" | "minStock">;
}) {
  const level = getStockLevel(product);
  if (level === "ok") return null;

  if (level === "out") {
    return <Badge variant="destructive">نفد</Badge>;
  }

  return (
    <Badge variant="outline" className="border-warning/50 text-warning">
      <IconAlertTriangle />
      باقي {formatQty(product.stock)}
    </Badge>
  );
}
