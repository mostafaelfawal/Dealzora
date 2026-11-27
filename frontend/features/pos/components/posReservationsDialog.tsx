"use client";

import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { fetchReservations } from "@/features/reservations/api/reservations.api";
import {
  RESERVATION_STATUS_INFO,
  reservationKeys,
} from "@/features/reservations/config/reservationOptions";
import { formatPickup } from "@/features/reservations/lib/reservationText";
import { formatItemCount } from "@/lib/format";
import { useFeature } from "@/lib/plan";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

import { POS_SHORTCUTS } from "../config/posShortcuts";
import { loadReservation } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectIsEmpty } from "../store/selectors";
import {
  PosPickerFooter,
  PosPickerHeader,
  pickerItemClass,
} from "./posPickerChrome";

/** أقصى عدد للحجوزات المفتوحة في القائمة (الباقي يُبحث عنه من صفحة الحجوزات). */
const PICKER_LIMIT = 200;

function ReservationItems() {
  const dispatch = useAppDispatch();
  const query = useQuery({
    queryKey: reservationKeys.list("open", "", 0),
    queryFn: () =>
      fetchReservations({
        filter: "open",
        q: "",
        page: 1,
        pageSize: PICKER_LIMIT,
      }),
    refetchOnMount: "always",
  });
  const items = query.data?.items ?? [];

  return (
    <>
      <CommandEmpty>
        {query.isPending ? (
          <p className="py-6 text-xs text-muted-foreground">جارٍ التحميل…</p>
        ) : query.isError ? (
          <p className="py-6 text-xs text-destructive">
            تعذّر تحميل الحجوزات. تحقق من الاتصال بالجهاز الأساسي.
          </p>
        ) : items.length ? (
          <div className="space-y-1 py-4 text-xs">
            <p className="text-sm font-medium text-foreground">
              لا يوجد حجز مطابق
            </p>
            <p className="text-muted-foreground">
              جرّب اسم العميل أو رقم هاتفه أو رقم الحجز.
            </p>
          </div>
        ) : (
          <div className="space-y-1 py-8 text-xs">
            <IconCalendarEvent className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              لا توجد حجوزات مفتوحة
            </p>
            <p className="text-muted-foreground">
              لحجز فاتورة اختر العميل ثم اضغط {POS_SHORTCUTS.reserve.label}.
            </p>
          </div>
        )}
      </CommandEmpty>

      {items.length > 0 && (
        <CommandGroup>
          {items.map((r) => {
            const info = RESERVATION_STATUS_INFO[r.status];
            const names = r.invoice.lines.map((l) => l.name).join("، ");
            return (
              <CommandItem
                key={r.id}
                value={`${r.number} ${r.customerName} ${r.customerPhone ?? ""} ${names}`}
                onSelect={() => void dispatch(loadReservation(r.id))}
                className={`${pickerItemClass} items-start`}
              >
                <span
                  aria-hidden
                  className="flex h-9 min-w-9 shrink-0 items-center justify-center bg-muted px-1 font-mono text-xs font-medium text-muted-foreground tabular-nums"
                >
                  #{r.number}
                </span>

                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-2">
                    <AppTooltip message={r.customerName} onlyWhenTruncated>
                      <span className="truncate text-sm font-medium">
                        {r.customerName}
                      </span>
                    </AppTooltip>
                    <span
                      className={cn(
                        "shrink-0 px-1.5 py-0.5 text-[10px]",
                        info.className,
                      )}
                    >
                      {r.status === "ready" && (
                        <IconCheck className="me-0.5 inline size-3" />
                      )}
                      {info.label}
                    </span>
                    {r.isOverdue && (
                      <Badge variant="destructive" className="shrink-0 gap-1">
                        <IconAlertTriangle className="size-3" />
                        متأخر
                      </Badge>
                    )}
                  </span>
                  <AppTooltip message={names} onlyWhenTruncated>
                    <span className="block truncate text-xs text-muted-foreground">
                      {names}
                    </span>
                  </AppTooltip>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatItemCount(r.itemCount)} · {formatPickup(r.pickupOn)}
                    {r.deposit > 0 && (
                      <>
                        {" · عربون "}
                        <Money amount={r.deposit} className="text-[11px]" />
                      </>
                    )}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    التقديري
                  </span>
                  <Money amount={r.total} className="text-lg font-semibold" />
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}
    </>
  );
}

/** الحجوزات المفتوحة: اختيار حجز يحمّله في الفاتورة لإتمام بيعه (الاستلام). */
export function PosReservationsDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "reservations");
  const currentHasItems = !useAppSelector(selectIsEmpty);
  const allowed = useFeature("customers");

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
      className="sm:max-w-xl"
      title="الحجوزات"
      description="اختر حجزاً لتحميله في الفاتورة وإتمام استلامه"
    >
      <PosPickerHeader icon={<IconCalendarEvent />} title="الحجوزات المفتوحة" />

      {!allowed ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          الحجوزات تحتاج ميزة العملاء في خطتك.
        </p>
      ) : (
        <>
          {currentHasItems && (
            <p className="flex items-center gap-2 border-b bg-warning/10 px-3 py-2 text-xs">
              <IconAlertTriangle className="size-4 shrink-0 text-warning" />
              الفاتورة الحالية ستُعلَّق تلقائياً عند تحميل الحجز، فلن تضيع.
            </p>
          )}
          <CommandInput placeholder="ابحث باسم العميل أو هاتفه أو رقم الحجز…" />
          <CommandList className="max-h-[55dvh]">
            {open && <ReservationItems />}
          </CommandList>
        </>
      )}

      <PosPickerFooter
        hints={[
          { keys: "↑ ↓", label: "تنقل" },
          { keys: "Enter", label: "استلام" },
          { keys: "Esc", label: "إغلاق" },
        ]}
      />
    </CommandDialog>
  );
}
