"use client";

import { IconChevronLeft, IconShoppingBag } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/lib/cart";

import { Price } from "./price";
import { useStore } from "./storeContext";

/** شريط السلة السفلي على الموبايل: الإجمالي وزر إتمام الطلب دائماً في متناول الإبهام. */
export function CartBar() {
  const store = useStore();
  const cart = useCart(store.slug);
  const path = usePathname();
  if (cart.count === 0 || path.endsWith("/cart") || path.includes("/order/"))
    return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur md:hidden">
      <Link
        href={`/${store.slug}/cart`}
        className="flex h-12 items-center gap-3 bg-primary px-4 text-primary-foreground active:scale-[0.99]"
      >
        <IconShoppingBag className="size-5" />
        <span className="flex-1 text-sm font-medium">
          السلة · {cart.count} صنف
        </span>
        <Price
          cents={cart.subtotal}
          currency={store.currency}
          className="[&_span:last-child]:text-primary-foreground/70"
        />
        <IconChevronLeft className="size-5" />
      </Link>
    </div>
  );
}
