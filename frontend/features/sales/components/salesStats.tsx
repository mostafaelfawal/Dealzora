"use client";

import {
  IconCalendarMonth,
  IconCalendarWeek,
  IconCoin,
  IconReceipt,
} from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { StatTile } from "@/components/shared/StatTile";

import { useSalesSummary } from "../hooks/useSales";

/** أرقام اليوم والأسبوع والشهر. الضغط على بطاقة يغيّر فترة القائمة. */
export function SalesStats({
  period,
  onPeriodChange,
}: {
  period: PeriodValue;
  onPeriodChange: (value: PeriodValue) => void;
}) {
  const s = useSalesSummary().data;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconReceipt />}
        label="صافي مبيعات اليوم"
        active={period.preset === "today"}
        onClick={() => onPeriodChange(periodOf("today"))}
        hint={s ? `${s.todayCount} فاتورة` : undefined}
      >
        <Money amount={s?.todayTotal ?? 0} className="text-lg" />
      </StatTile>
      <StatTile
        index={1}
        icon={<IconCoin />}
        label="ربح اليوم"
        tone="success"
        hint={s && s.todayReturns > 0 ? `مرتجع ${s.todayReturns}` : undefined}
      >
        <Money amount={s?.todayProfit ?? 0} className="text-lg" />
      </StatTile>
      <StatTile
        index={2}
        icon={<IconCalendarWeek />}
        label="آخر 7 أيام"
        active={period.preset === "week"}
        onClick={() => onPeriodChange(periodOf("week"))}
      >
        <Money amount={s?.weekTotal ?? 0} className="text-lg" />
      </StatTile>
      <StatTile
        index={3}
        icon={<IconCalendarMonth />}
        label="هذا الشهر"
        active={period.preset === "month"}
        onClick={() => onPeriodChange(periodOf("month"))}
        hint={s ? `ربح ${s.monthProfit.toLocaleString("en-US")}` : undefined}
      >
        <Money amount={s?.monthTotal ?? 0} className="text-lg" />
      </StatTile>
    </div>
  );
}
