"use client";

import {
  PeriodPicker,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { formatNumber, formatTime } from "@/lib/format";

import { greeting } from "../lib/dashboardSeries";
import type { Overview } from "../types/dashboard";

function shiftLine(shift: Overview["shift"] | undefined) {
  if (!shift) return "لا توجد وردية مفتوحة الآن.";
  return [
    `الوردية مفتوحة مع ${shift.cashierName ?? "—"} منذ ${formatTime(shift.openedAt)}`,
    `${shift.salesCount} فاتورة`,
    `في الدرج ${formatNumber(shift.expectedCash)} ج.م`,
  ].join(" · ");
}

/** التحية + حالة الوردية + اختيار الفترة. */
export function DashboardHeader({
  userName,
  shift,
  period,
  onPeriodChange,
}: {
  userName: string;
  shift: Overview["shift"] | undefined;
  period: PeriodValue;
  onPeriodChange: (value: PeriodValue) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold">
          {greeting()}، {userName} نظرة سريعه!
        </h1>
        <p className="text-xs text-muted-foreground">{shiftLine(shift)}</p>
      </div>
      <PeriodPicker value={period} onChange={onPeriodChange} />
    </header>
  );
}
