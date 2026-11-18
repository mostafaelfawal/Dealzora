"use client";

import {
  IconCheck,
  IconChevronLeft,
  IconInbox,
  IconMapPin,
  IconSearch,
  IconShoppingBag,
} from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { listItem, MotionLi } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatWhen } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { useSetOrderStatus, useStoreOrders } from "../hooks/useOnlineStore";
import { filterCount, NEXT_STEP, ORDER_FILTERS } from "../lib/storeText";
import type { OrderFilter, StoreOrder } from "../types/store";
import { OrderDetailSheet, StatusBadge } from "./orderDetailSheet";

const PAGE_SIZE = 30;

function OrderCard({
  o,
  index,
  onOpen,
}: {
  o: StoreOrder;
  index: number;
  onOpen: () => void;
}) {
  const step = NEXT_STEP[o.status];
  const mutation = useSetOrderStatus();
  return (
    <MotionLi
      {...listItem(index)}
      className={cn(
        "group flex flex-col gap-3 border bg-card p-4 transition-colors hover:border-primary/50",
        o.status === "new" && "border-primary/60",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center",
            o.status === "new"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <IconShoppingBag className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">#{o.number}</span>
            <StatusBadge status={o.status} />
            {o.previousOrders > 0 && (
              <span className="text-[11px] text-muted-foreground">
                عميل متكرر
              </span>
            )}
          </span>
          <span className="block truncate font-medium">{o.customerName}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <IconMapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {o.city ? `${o.city} — ` : ""}
              {o.address}
            </span>
          </span>
        </span>
        <IconChevronLeft className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
      </button>
      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          {formatWhen(o.createdAt)} · {o.itemsCount} صنف
        </span>
        <Money amount={o.total} className="font-semibold" />
        {step && (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ id: o.id, status: step.status })}
          >
            <IconCheck className="size-4" />
            {step.label}
          </Button>
        )}
      </div>
    </MotionLi>
  );
}

/** الطلبات: الأحدث أولاً، والخطوة التالية بضغطة واحدة من البطاقة. */
export function StoreOrders({
  storeName,
  openId,
  onOpenChange,
}: {
  storeName: string;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<OrderFilter>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 350);
  const query = useStoreOrders({
    status: filter,
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SegmentedTabs
          label="حالة الطلبات"
          items={ORDER_FILTERS.map((f) => ({
            ...f,
            count: filterCount(data?.counts, f.id),
          }))}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          className="min-w-0 flex-1"
        />
        <div className="relative sm:w-64">
          <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="رقم الطلب أو الاسم أو الهاتف"
            aria-label="بحث في الطلبات"
            className="h-10 ps-8"
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border bg-card p-10 text-center">
          <IconInbox className="size-10 text-muted-foreground" />
          <p className="font-medium">
            {q ? "لا طلبات مطابقة للبحث" : "لا توجد طلبات هنا"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            الطلبات الجديدة تظهر هنا تلقائياً خلال دقيقة من وصولها، ويظهر عددها
            بجانب «المتجر الإلكتروني» في القائمة الجانبية.
          </p>
        </div>
      ) : (
        <>
          <ul
            className={cn(
              "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
              query.isFetching && "opacity-80",
            )}
          >
            {data.items.map((o, i) => (
              <OrderCard
                key={o.id}
                o={o}
                index={i}
                onOpen={() => onOpenChange(o.id)}
              />
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                السابق
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </>
      )}

      <OrderDetailSheet
        orderId={openId}
        storeName={storeName}
        onClose={() => onOpenChange(null)}
      />
    </div>
  );
}
