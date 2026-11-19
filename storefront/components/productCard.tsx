"use client";

import { IconPhoto, IconPlus, IconStarFilled } from "@tabler/icons-react";
import Link from "next/link";

import { useCart } from "@/lib/cart";
import type { PublicProduct } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Price } from "./price";
import { QtyStepper } from "./qtyStepper";
import { useStore } from "./storeContext";
import { Button } from "./ui";

export function ProductImage({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- صور مضغوطة مسبقاً من السيرفر نفسه
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/70">
          <IconPhoto className="size-8" />
          <span className="line-clamp-1 px-3 text-center text-xs">{name}</span>
        </span>
      )}
    </div>
  );
}

/** بطاقة صنف: الصورة والاسم والسعر، وإضافة للسلة ثم تعديل الكمية في مكانها. */
export function ProductCard({ p }: { p: PublicProduct }) {
  const store = useStore();
  const cart = useCart(store.slug);
  const qty = cart.qtyOf(p.gid);
  const href = `/${store.slug}/p/${p.gid}`;
  const canOrder = p.available && store.accepting_orders;

  return (
    <article className="group relative flex flex-col border bg-card transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-[0_8px_30px_-12px_oklch(0_0_0/0.25)]">
      <Link
        href={href}
        className="outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <ProductImage
          url={p.image_url}
          name={p.name}
          className="aspect-square"
        />
        <span className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
          {p.featured && (
            <span className="flex items-center gap-1 bg-background/90 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
              <IconStarFilled className="size-3 text-warning" />
              مميز
            </span>
          )}
          {!p.available ? (
            <span className="bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium text-background">
              نفد
            </span>
          ) : p.low_stock ? (
            <span className="bg-warning px-1.5 py-0.5 text-[10px] font-medium text-black">
              كمية محدودة
            </span>
          ) : null}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          href={href}
          className="line-clamp-2 min-h-[2.5rem] text-sm leading-5 font-medium hover:underline"
        >
          {p.name}
        </Link>
        <div className="flex items-baseline justify-between gap-1">
          <Price
            cents={p.price}
            currency={store.currency}
            className="text-base"
          />
          <span className="text-[11px] text-muted-foreground">/ {p.unit}</span>
        </div>
        <div className="mt-auto">
          {qty > 0 ? (
            <QtyStepper
              qty={qty}
              step={p.step}
              max={p.max_qty}
              unit={p.unit}
              size="sm"
              onChange={(v) => cart.setQty(p.gid, v)}
            />
          ) : (
            <Button
              size="sm"
              variant={canOrder ? "default" : "outline"}
              className="h-9 w-full"
              disabled={!canOrder}
              onClick={() => cart.add(p)}
            >
              {canOrder ? (
                <>
                  <IconPlus />
                  أضف للسلة
                </>
              ) : p.available ? (
                "الطلبات متوقفة"
              ) : (
                "غير متوفر حالياً"
              )}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
