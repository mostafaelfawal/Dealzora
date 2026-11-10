"use client";

import {
  IconClockHour4,
  IconLockDollar,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useState } from "react";

import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CloseShiftDialog,
  OpenShiftDialog,
} from "@/features/shifts/components/shiftDialogs";
import type { Shift } from "@/types/shell";

interface ShiftStatusProps {
  shift: Shift | null;
  showLabels?: boolean;
}

export function ShiftStatus({ shift, showLabels = false }: ShiftStatusProps) {
  const isOpen = shift !== null;
  const [popover, setPopover] = useState(false);
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);

  function openDialog(next: "open" | "close") {
    setPopover(false);
    setDialog(next);
  }

  return (
    <>
      <Popover open={popover} onOpenChange={setPopover}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="lg"
              className="gap-2 px-2 font-normal"
            />
          }
        >
          <StatusDot tone={isOpen ? "success" : "warning"} pulse={isOpen} />
          <span
            className={cn(
              "text-sm",
              showLabels ? "inline" : "sr-only xl:not-sr-only",
            )}
          >
            {isOpen ? "الوردية مفتوحة" : "لا توجد وردية مفتوحة"}
          </span>
          {isOpen && (
            <span
              className={cn(
                "text-sm text-muted-foreground",
                showLabels ? "hidden sm:inline" : "hidden 2xl:inline",
              )}
              suppressHydrationWarning
            >
              · {shift.cashierName} منذ {formatTime(shift.openedAt)}
            </span>
          )}
          {!showLabels && (
            <IconClockHour4 className="size-4 text-muted-foreground xl:hidden" />
          )}
        </PopoverTrigger>

        <PopoverContent align="end" className="w-64">
          {isOpen ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">الوردية الحالية</p>
                <p
                  className="text-sm text-muted-foreground"
                  suppressHydrationWarning
                >
                  {shift.cashierName ?? "—"} · فُتحت{" "}
                  {formatTime(shift.openedAt)} · {shift.salesCount} فاتورة
                </p>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => openDialog("close")}
                className="w-full"
              >
                <IconLockDollar className="size-4" />
                قفل الوردية وجرد الدرج
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                افتح وردية عشان تقدر تسجّل مبيعات وتتابع رصيد الدرج.
              </p>
              <Button
                size="lg"
                onClick={() => openDialog("open")}
                className="w-full"
              >
                <IconPlayerPlay className="size-4" />
                فتح وردية
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
      <OpenShiftDialog
        open={dialog === "open"}
        onClose={() => setDialog(null)}
      />
      <CloseShiftDialog
        shift={shift}
        open={dialog === "close"}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
