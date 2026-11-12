"use client";

import {
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconFileText,
  IconPackageImport,
  IconSend,
} from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import {
  ORDER_STATUS_TABS,
  ORDERS_PAGE_SIZE,
  STATUS_INFO,
} from "../config/purchaseOrderOptions";
import { useOrders, useOrdersSummary } from "../hooks/usePurchaseOrders";
import type { OrderStatusFilter } from "../types/purchaseOrder";
import { OrderDetailSheet } from "./orderDetailSheet";

/** طلبات الشراء: مسودة ← أُرسل للمورد ← تم الاستلام (فاتورة شراء). */
export function OrdersList({
  onGoSuggestions,
}: {
  onGoSuggestions: () => void;
}) {
  const [status, setStatus] = useState<OrderStatusFilter>("open");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const summary = useOrdersSummary().data;
  const query = useOrders(status, page, ORDERS_PAGE_SIZE);
  const pages = Math.max(
    Math.ceil((query.data?.total ?? 0) / ORDERS_PAGE_SIZE),
    1,
  );

  const changeStatus = (s: OrderStatusFilter) => {
    setStatus(s);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile index={0} icon={<IconFileText />} label="مسودات">
          {summary?.draft ?? 0}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconSend />}
          label="أُرسلت وننتظر البضاعة"
          tone="warning"
        >
          {summary?.sent ?? 0}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconClipboardList />}
          label="قيمة الطلبات المفتوحة"
        >
          <Money amount={summary?.openTotal ?? 0} className="text-lg" />
        </StatTile>
        <StatTile
          index={3}
          icon={<IconPackageImport />}
          label="استُلمت هذا الشهر"
          tone="success"
        >
          {summary?.receivedMonth ?? 0}
        </StatTile>
      </div>

      <SegmentedTabs
        label="حالة الطلب"
        items={ORDER_STATUS_TABS.map((t) => ({
          ...t,
          count:
            t.id === "open" && summary
              ? summary.draft + summary.sent
              : undefined,
        }))}
        value={status}
        onChange={changeStatus}
      />

      {query.isPending ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !query.data?.items.length ? (
        <div className="flex flex-col items-center gap-3 border bg-card p-10 text-center">
          <IconClipboardList className="size-10 text-muted-foreground" />
          <p className="font-medium">لا توجد طلبات هنا</p>
          {status === "open" && (
            <Button onClick={onGoSuggestions}>راجع النواقص المقترحة</Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map((o, i) => {
            const info = STATUS_INFO[o.status];
            return (
              <MotionLi key={o.id} {...listItem(i)}>
                <button
                  type="button"
                  onClick={() => setOpenId(o.id)}
                  className="flex w-full flex-col gap-2 border bg-card p-3 text-start transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{o.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {o.supplierName}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[11px]",
                        info.className,
                      )}
                    >
                      {info.label}
                    </span>
                  </span>
                  <span className="flex w-full items-end justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {o.lines.length} صنف · {formatDate(o.createdAt)}
                      {o.purchaseNumber &&
                        ` · فاتورة شراء #${o.purchaseNumber}`}
                    </span>
                    <Money amount={o.total} className="text-base" />
                  </span>
                </button>
              </MotionLi>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="السابق"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <IconChevronRight className="size-4" />
          </Button>
          <span className="font-mono text-sm">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="التالي"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <IconChevronLeft className="size-4" />
          </Button>
        </div>
      )}

      <OrderDetailSheet orderId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
