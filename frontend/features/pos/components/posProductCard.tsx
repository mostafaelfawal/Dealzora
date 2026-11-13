"use client";

import { IconBarcode } from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { formatQty } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { getStockLevel } from "../lib/posCalc";
import { addToCart } from "../store/posActions";
import type { PosProduct } from "../types/pos";

import { PosStockBadge } from "./posStockBadge";

/** بطاقة صنف للمس والفأرة. لوحة المفاتيح تستخدم البحث. */
export function PosProductCard({ product }: { product: PosProduct }) {
  const dispatch = useAppDispatch();
  /** الكمية الموجودة من هذا الصنف في الفاتورة الحالية (0 = غير مضاف). */
  const inCartQty = useAppSelector(
    (s) =>
      s.cart.present.lines.find((l) => l.productId === product.id && !l.unitId)
        ?.qty ?? 0,
  );

  const level = getStockLevel(product);
  const out = level === "out";
  const stockOk = level === "ok";
  const inCart = inCartQty > 0;

  return (
    <button
      type="button"
      onClick={() => dispatch(addToCart(product))}
      className={cn(
        "group relative flex h-full min-h-32 w-full min-w-0 flex-col justify-between gap-3 border bg-card p-3.5 text-start outline-none",
        "transition-[border-color,transform] duration-150",
        "hover:border-primary/60 active:scale-[0.98]",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        inCart && "border-primary/40",
      )}
    >
      {/* شريط الشارات على الحافة العلوية: المخزون (البداية) والكمية في الفاتورة (النهاية).
          في حاوية واحدة حتى لا تتداخل الشارتان مهما ضاقت البطاقة. */}
      {(inCart || !stockOk) && (
        <span className="pointer-events-none absolute inset-x-3 -top-2.5 z-10 flex items-center justify-between gap-1">
          <span className="min-w-0">
            <PosStockBadge product={product} />
          </span>
          {inCart && (
            <span
              dir="ltr"
              aria-label={`في الفاتورة: ${formatQty(inCartQty)}`}
              className="ms-auto flex h-5 min-w-6 shrink-0 items-center justify-center bg-primary px-1.5 font-mono text-xs font-medium text-primary-foreground tabular-nums"
            >
              {formatQty(inCartQty)}
            </span>
          )}
        </span>
      )}

      {/* الاسم وكود المنتج */}
      <span className={cn("block min-w-0 space-y-1", out && "opacity-80")}>
        <span className="line-clamp-2 block text-[13px] leading-snug font-medium text-foreground">
          {product.name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <IconBarcode className="size-3.5 shrink-0" aria-hidden />
          <AppTooltip message={product.barcode}>
            <span
              dir="ltr"
              className="min-w-0 truncate text-start font-mono text-[11px]"
            >
              {product.barcode}
            </span>
          </AppTooltip>
        </span>
      </span>

      {/* السعر */}
      <span
        className={cn(
          "flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 border-t border-border/60 pt-2.5",
          out && "opacity-80",
        )}
      >
        <Money amount={product.price} className="text-lg font-semibold" />
        <span className="text-[11px] text-muted-foreground">
          / {product.unit}
        </span>
      </span>
    </button>
  );
}
