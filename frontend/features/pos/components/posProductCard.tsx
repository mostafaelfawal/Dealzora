import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import type { PosProduct } from "../types/pos";

import { PosStockBadge } from "./posStockBadge";

interface PosProductCardProps {
  product: PosProduct;
  onAdd: (product: PosProduct) => void;
}

/** كارت صنف للمس والماوس. الكيبورد بيستخدم البحث. */
export function PosProductCard({ product, onAdd }: PosProductCardProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => onAdd(product)}
      className="h-auto min-h-24 flex-col items-stretch justify-between gap-2 p-2.5 text-start font-normal whitespace-normal"
    >
      <span className="space-y-1">
        <span className="line-clamp-2 block text-xs leading-snug font-medium">
          {product.name}
        </span>
        <span
          dir="ltr"
          className="block text-start font-mono text-[11px] text-muted-foreground"
        >
          {product.barcode}
        </span>
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="flex items-baseline gap-1">
          <Money amount={product.price} className="text-sm" />
          <span className="text-[11px] text-muted-foreground">
            / {product.unit}
          </span>
        </span>
        <PosStockBadge product={product} />
      </span>
    </Button>
  );
}
