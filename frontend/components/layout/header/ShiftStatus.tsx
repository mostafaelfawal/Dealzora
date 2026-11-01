"use client";

import { IconClockHour4 } from "@tabler/icons-react";
import Link from "next/link";

import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Shift } from "@/types/shell";

interface ShiftStatusProps {
  shift: Shift | null;
  showLabels?: boolean;
}

export function ShiftStatus({ shift, showLabels = false }: ShiftStatusProps) {
  const isOpen = shift !== null;

  return (
    <Popover>
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
                {shift.cashierName} · فُتحت {formatTime(shift.openedAt)}
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/shifts/close" />}
              className="w-full"
            >
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
              nativeButton={false}
              render={<Link href="/shifts/open" />}
              className="w-full"
            >
              فتح وردية
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
