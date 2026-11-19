"use client";

import { IconCheck, IconShoppingBag } from "@tabler/icons-react";
import { useState } from "react";

import { useCart } from "@/lib/cart";
import { formatQty } from "@/lib/format";
import type { PublicProduct } from "@/lib/types";

import { QtyStepper } from "./qtyStepper";
import { useStore } from "./storeContext";
import { Button, ButtonLink } from "./ui";

/** صفحة الصنف: اختيار الكمية ثم الإضافة، أو تعديل الكمية لو الصنف في السلة بالفعل. */
export function ProductActions({ p }: { p: PublicProduct }) {
  const store = useStore();
  const cart = useCart(store.slug);
  const inCart = cart.qtyOf(p.gid);
  const [qty, setQty] = useState(p.step);
  const canOrder = p.available && store.accepting_orders;

  if (!canOrder)
    return (
      <p className="border bg-muted p-3 text-sm">
        {p.available
          ? "المتجر لا يستقبل طلبات الآن."
          : "هذا الصنف غير متوفر حالياً."}
      </p>
    );

  if (inCart > 0)
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm text-success">
          <IconCheck className="size-4" />
          في السلة: {formatQty(inCart)} {p.unit}
        </p>
        <div className="flex gap-2">
          <QtyStepper
            qty={inCart}
            step={p.step}
            max={p.max_qty}
            unit={p.unit}
            className="w-44"
            onChange={(v) => cart.setQty(p.gid, v)}
          />
          <ButtonLink href={`/${store.slug}/cart`} size="lg" className="flex-1">
            <IconShoppingBag />
            إتمام الطلب
          </ButtonLink>
        </div>
      </div>
    );

  return (
    <div className="flex gap-2">
      <QtyStepper
        qty={qty}
        step={p.step}
        max={p.max_qty}
        unit={p.unit}
        className="w-44"
        onChange={(v) => setQty(Math.max(p.step, v))}
      />
      <Button size="lg" className="flex-1" onClick={() => cart.add(p, qty)}>
        <IconShoppingBag />
        أضف للسلة
      </Button>
    </div>
  );
}
