"use client";

import { IconBarcode } from "@tabler/icons-react";
import Link from "next/link";

import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { PosStockBadge } from "@/features/pos/components/posStockBadge";
import { getStockLevel } from "@/features/pos/lib/posCalc";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { stockRatio } from "../lib/productCalc";
import { getCategoryLabel } from "../lib/productList";
import type { Product } from "../types/product";
import { ProductActionsMenu, type ProductActions } from "./productActionsMenu";
import { ProductMarginBadge } from "./productMarginBadge";
import {
  listItem,
  MotionArticle,
  ProgressBar,
} from "@/components/shared/motion";

const BAR_TONE = {
  ok: "bg-primary",
  low: "bg-warning",
  out: "bg-destructive",
} as const;

interface ProductCardProps extends ProductActions {
  product: Product;
  /** ترتيب البطاقة، لتأخير ظهورها قليلاً عن اللي قبلها. */
  index: number;
}

/** بطاقة صنف. الاسم رابط يغطي البطاقة كلها، وقائمة الإجراءات فوقه. */
export function ProductCard({ product, index, ...actions }: ProductCardProps) {
  const level = getStockLevel(product);

  return (
    <MotionArticle
      {...listItem(index)}
      className={cn(
        "group relative flex flex-col gap-3 border bg-card p-3.5",
        "transition-[border-color,transform] duration-150",
        "hover:border-primary/60 active:scale-[0.99]",
        "focus-within:border-primary",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2",
          !product.isActive && "opacity-60",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={PRODUCT_ROUTES.edit(product.id)}
            className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-primary/40"
          >
            {product.name}
          </Link>
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <IconBarcode className="size-3.5 shrink-0" aria-hidden />
            <span
              dir="ltr"
              className="min-w-0 truncate text-start font-mono text-[11px]"
            >
              {product.barcode || "بدون باركود"}
            </span>
          </span>
        </div>
        <div className="relative z-10 -mt-1 -ms-1 shrink-0">
          <ProductActionsMenu product={product} {...actions} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {!product.isActive && (
          <Badge variant="secondary" className="font-normal">
            معطّل
          </Badge>
        )}
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {getCategoryLabel(product.category)}
        </Badge>
        {product.allowDecimal && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            بالوزن
          </Badge>
        )}
        {product.extraUnits.length > 0 && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            +{product.extraUnits.length} وحدة
          </Badge>
        )}
        <PosStockBadge product={product} />
      </div>

      <div
        className={cn(
          "flex items-end justify-between gap-2 border-t border-border/60 pt-2.5",
          !product.isActive && "opacity-60",
        )}
      >
        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <Money
              amount={product.salePrice}
              className="text-lg font-semibold"
            />
            <span className="text-[11px] text-muted-foreground">
              / {product.unit}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            شراء{" "}
            <bdi dir="ltr" className="font-mono">
              {product.costPrice}
            </bdi>
          </p>
        </div>
        <ProductMarginBadge cost={product.costPrice} sale={product.salePrice} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>المخزون</span>
          <span>
            <bdi dir="ltr" className="font-mono text-foreground tabular-nums">
              {formatQty(product.stock)}
            </bdi>{" "}
            {product.unit}
          </span>
        </div>
        <ProgressBar
          value={stockRatio(product.stock, product.minStock)}
          className="h-0.5"
          barClassName={BAR_TONE[level]}
        />
      </div>
    </MotionArticle>
  );
}
