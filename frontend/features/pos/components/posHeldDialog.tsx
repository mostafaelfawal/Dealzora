"use client";

import {
  IconClock,
  IconInfoCircle,
  IconPlayerPause,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

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
import { formatTime } from "@/lib/format";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { calcTotals, formatQty } from "../lib/posCalc";
import type { HeldInvoice } from "../types/pos";

import {
  PosPickerFooter,
  PosPickerHeader,
  pickerItemClass,
} from "./posPickerChrome";

interface PosHeldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  held: HeldInvoice[];
  /** إذا كانت الفاتورة الحالية تحتوي أصنافاً، فستُعلَّق تلقائياً عند الاسترجاع. */
  currentHasItems: boolean;
  onRecall: (id: string) => void;
}

/** "منذ 5 دقائق" بقواعد الجمع العربية. */
function timeAgo(from: number, now: number) {
  const minutes = Math.max(Math.floor((now - from) / 60_000), 0);
  if (minutes < 1) return "الآن";
  if (minutes < 60) {
    if (minutes === 1) return "منذ دقيقة";
    if (minutes === 2) return "منذ دقيقتين";
    return `منذ ${minutes} ${minutes <= 10 ? "دقائق" : "دقيقة"}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return "منذ ساعة";
    if (hours === 2) return "منذ ساعتين";
    return `منذ ${hours} ${hours <= 10 ? "ساعات" : "ساعة"}`;
  }
  return formatTime(new Date(from).toISOString());
}

/** وقت حالي يتجدد كل نصف دقيقة طالما القائمة مفتوحة (تُركَّب عند فتح النافذة فقط). */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function HeldItems({
  held,
  onRecall,
}: {
  held: HeldInvoice[];
  onRecall: (id: string) => void;
}) {
  const now = useNow();

  return (
    <>
      {held.map((h, index) => {
        const totals = calcTotals(h.invoice);
        const lines = h.invoice.lines;
        const customerName = h.invoice.customer?.name ?? "عميل نقدي";
        const preview = lines
          .slice(0, 2)
          .map((l) => l.name)
          .join("، ");
        const extra = lines.length - 2;
        const names = lines.map((l) => l.name).join(" ");

        return (
          <CommandItem
            key={h.id}
            value={`${h.id} ${customerName} ${names}`}
            onSelect={() => onRecall(h.id)}
            className={`${pickerItemClass} items-start`}
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center bg-muted font-mono text-sm font-medium text-muted-foreground tabular-nums"
            >
              {index + 1}
            </span>

            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {customerName}
                </span>
                {index === 0 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 font-normal text-muted-foreground"
                  >
                    الأحدث
                  </Badge>
                )}
              </span>

              <span className="block truncate text-xs text-muted-foreground">
                {preview}
                {extra > 0 && (
                  <>
                    {" "}
                    <bdi dir="ltr" className="font-mono">
                      +{extra}
                    </bdi>
                  </>
                )}
              </span>

              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>
                  {totals.itemCount} صنف · {formatQty(totals.qtyCount)} وحدة
                </span>
                <span aria-hidden>·</span>
                <span
                  className="flex items-center gap-1"
                  title={formatTime(new Date(h.heldAt).toISOString())}
                >
                  <IconClock className="size-3" aria-hidden />
                  {timeAgo(h.heldAt, now)}
                </span>
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-[11px] text-muted-foreground">
                الإجمالي
              </span>
              <Money amount={totals.total} className="text-lg font-semibold" />
            </span>
          </CommandItem>
        );
      })}
    </>
  );
}

export function PosHeldDialog({
  open,
  onOpenChange,
  held,
  currentHasItems,
  onRecall,
}: PosHeldDialogProps) {
  const hasHeld = held.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-xl"
      title="الفواتير المعلّقة"
      description={
        currentHasItems
          ? "اختر فاتورة لاسترجاعها. ستُعلَّق الفاتورة الحالية تلقائياً."
          : "اختر فاتورة لاسترجاعها."
      }
    >
      <PosPickerHeader
        icon={<IconPlayerPause />}
        title="الفواتير المعلّقة"
        meta={hasHeld ? `${held.length} فاتورة` : undefined}
      />

      {currentHasItems && hasHeld && (
        <p className="flex items-center gap-2 border-b bg-warning/10 px-3 py-2 text-xs">
          <IconInfoCircle className="size-4 shrink-0 text-warning" />
          الفاتورة الحالية ستُعلَّق تلقائياً عند الاسترجاع، فلن تضيع.
        </p>
      )}

      {hasHeld && <CommandInput placeholder="ابحث باسم العميل أو الصنف…" />}

      <CommandList className="max-h-[55dvh]">
        <CommandEmpty>
          {hasHeld ? (
            <div className="space-y-1 py-4 text-xs">
              <p className="text-sm font-medium text-foreground">
                لا توجد فاتورة مطابقة
              </p>
              <p className="text-muted-foreground">
                جرّب اسم العميل أو اسم صنف داخل الفاتورة.
              </p>
            </div>
          ) : (
            <div className="space-y-1 py-8 text-xs">
              <IconPlayerPause className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                لا توجد فواتير معلّقة
              </p>
              <p className="text-muted-foreground">
                اضغط {POS_SHORTCUTS.holdInvoice.label} لتعليق الفاتورة الحالية
                وخدمة عميل آخر.
              </p>
            </div>
          )}
        </CommandEmpty>

        {hasHeld && (
          <CommandGroup>
            <HeldItems held={held} onRecall={onRecall} />
          </CommandGroup>
        )}
      </CommandList>

      <PosPickerFooter
        hints={
          hasHeld
            ? [
                { keys: "↑ ↓", label: "تنقل" },
                { keys: "Enter", label: "استرجاع" },
                { keys: "Esc", label: "إغلاق" },
              ]
            : [{ keys: "Esc", label: "إغلاق" }]
        }
      />
    </CommandDialog>
  );
}
