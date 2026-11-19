"use client";

import { IconChevronLeft, IconReceipt } from "@tabler/icons-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { loadOrders, type SavedOrder } from "@/lib/cart";
import { formatDateTime } from "@/lib/format";

import { Price } from "./price";
import { useStore } from "./storeContext";
import { ButtonLink } from "./ui";

const EMPTY: SavedOrder[] = [];
const cache = new Map<string, { raw: string; list: SavedOrder[] }>();

function snapshot(slug: string): SavedOrder[] {
  const list = loadOrders(slug);
  const raw = JSON.stringify(list);
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.list;
  cache.set(slug, { raw, list });
  return list;
}

/** الطلبات المرسلة من هذا المتصفح (روابط المتابعة محفوظة محلياً فقط، لا حسابات ولا كلمات مرور). */
export function MyOrders() {
  const store = useStore();
  const orders = useSyncExternalStore(
    () => () => {},
    () => snapshot(store.slug),
    () => EMPTY,
  );

  if (orders.length === 0)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <IconReceipt className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">لا توجد طلبات من هذا الجهاز</h1>
        <p className="text-sm text-muted-foreground">
          الطلبات التي ترسلها من هذا المتصفح تظهر هنا لتتابعها بسهولة.
        </p>
        <ButtonLink href={`/${store.slug}`}>تصفّح المتجر</ButtonLink>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-xl font-bold">طلباتي</h1>
      <ul className="divide-y border bg-card">
        {orders.map((o) => (
          <li key={o.token}>
            <Link
              href={`/${store.slug}/order/${o.token}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50"
            >
              <IconReceipt className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-mono font-semibold">
                  #{o.number}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(o.at)}
                </span>
              </span>
              <Price cents={o.total} currency={store.currency} />
              <IconChevronLeft className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
