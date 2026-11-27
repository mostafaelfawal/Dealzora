"use client";

import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClockHour4,
  IconDeviceDesktop,
  IconSearch,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { POS_SHORTCUTS } from "@/features/pos/config/posShortcuts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatItemCount } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  RESERVATION_FILTER_TABS,
  RESERVATION_ROUTES,
  RESERVATION_STATUS_INFO,
  RESERVATIONS_PAGE_SIZE,
} from "../config/reservationOptions";
import { useReservations } from "../hooks/useReservations";
import { formatPickup } from "../lib/reservationText";
import type {
  ReservationCounts,
  ReservationFilter,
} from "../types/reservation";
import { ReservationDetailSheet } from "./reservationDetailSheet";

function tabCount(id: ReservationFilter, c: ReservationCounts | undefined) {
  if (!c) return undefined;
  if (id === "open") return c.pending + c.ready;
  if (id === "pending") return c.pending;
  if (id === "ready") return c.ready;
  if (id === "overdue") return c.overdue;
  return undefined;
}

/** حجوزات العملاء: قيد التجهيز ← جاهز ← استلام في الكاشير (فاتورة بيع) أو إلغاء. */
export function ReservationsScreen() {
  const [filter, setFilter] = useState<ReservationFilter>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebouncedValue(search.trim());
  const query = useReservations(filter, q, page);
  const counts = query.data?.counts;
  const pages = Math.max(
    Math.ceil((query.data?.total ?? 0) / RESERVATIONS_PAGE_SIZE),
    1,
  );

  const changeFilter = (f: ReservationFilter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="الحجوزات"
        description={`أصناف يحجزها العميل ويستلمها لاحقاً، بعربون اختياري يُخصم من فاتورة الاستلام. الحجز يُسجَّل من الكاشير: اختر العميل والأصناف ثم «حجز» (${POS_SHORTCUTS.reserve.label}).`}
        actions={
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href={RESERVATION_ROUTES.pos} />}
            className="h-10 gap-2 font-normal"
          >
            <IconDeviceDesktop className="size-4" />
            حجز جديد من الكاشير
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile index={0} icon={<IconClockHour4 />} label="قيد التجهيز">
          {counts?.pending ?? 0}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconCheck />}
          label="جاهزة للاستلام"
          tone="success"
        >
          {counts?.ready ?? 0}
          {counts && counts.dueToday > 0 && (
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              · {counts.dueToday} موعدها اليوم
            </span>
          )}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconAlertTriangle />}
          label="تجاوزت موعد الاستلام"
          tone={counts?.overdue ? "danger" : "default"}
        >
          {counts?.overdue ?? 0}
        </StatTile>
        <StatTile
          index={3}
          icon={<IconCash />}
          label="عرابين الحجوزات المفتوحة"
        >
          <Money amount={counts?.openDeposits ?? 0} className="text-lg" />
        </StatTile>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="حالة الحجز"
          items={RESERVATION_FILTER_TABS.map((t) => ({
            ...t,
            count: tabCount(t.id, counts),
          }))}
          value={filter}
          onChange={changeFilter}
          className="min-w-0 flex-1"
        />
        <InputGroup className="h-10 w-full sm:w-72">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            data-page-search
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="رقم الحجز أو اسم/هاتف العميل…"
            aria-label="بحث في الحجوزات"
          />
        </InputGroup>
      </div>

      {query.isPending ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !query.data?.items.length ? (
        <div className="flex flex-col items-center gap-3 border bg-card p-10 text-center">
          <IconCalendarEvent className="size-10 text-muted-foreground" />
          <p className="font-medium">
            {q ? "لا يوجد حجز مطابق" : "لا توجد حجوزات هنا"}
          </p>
          {!q && filter === "open" && (
            <p className="max-w-md text-sm text-muted-foreground">
              من الكاشير: اختر العميل وأضف الأصناف، ثم اضغط «حجز» وحدد موعد
              الاستلام والعربون.
            </p>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map((r, i) => {
            const info = RESERVATION_STATUS_INFO[r.status];
            const names = r.invoice.lines.map((l) => l.name).join("، ");
            return (
              <MotionLi key={r.id} {...listItem(i)}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className={cn(
                    "flex w-full flex-col gap-2 border bg-card p-3 text-start transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    r.isOverdue && "border-destructive/40",
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{r.number}
                    </span>
                    <AppTooltip message={r.customerName} onlyWhenTruncated>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {r.customerName}
                      </span>
                    </AppTooltip>
                    <span
                      className={cn(
                        "shrink-0 px-1.5 py-0.5 text-[11px]",
                        info.className,
                      )}
                    >
                      {info.label}
                    </span>
                  </span>
                  <AppTooltip message={names} onlyWhenTruncated>
                    <span className="block w-full truncate text-xs text-muted-foreground">
                      {names}
                    </span>
                  </AppTooltip>
                  <span className="flex w-full items-end justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatItemCount(r.itemCount)} ·{" "}
                      <span
                        className={cn(
                          r.isOverdue && "font-medium text-destructive",
                        )}
                      >
                        {r.status === "picked_up" && r.saleNumber
                          ? `فاتورة #${r.saleNumber}`
                          : formatPickup(r.pickupOn)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end">
                      {r.deposit > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          عربون{" "}
                          <Money amount={r.deposit} className="text-[11px]" />
                        </span>
                      )}
                      <Money amount={r.total} className="text-base" />
                    </span>
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

      <ReservationDetailSheet
        reservationId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
