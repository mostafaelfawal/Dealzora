"use client";

import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconWallet,
} from "@tabler/icons-react";

import { ChartCard } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import type { DateRange } from "@/lib/dates";

import { useTreasuryReport } from "../hooks/useReports";
import {
  cashKindLabel,
  kindRowKey,
  treasuryKindItems,
} from "../lib/reportSeries";
import type { TreasuryReport } from "../types/report";
import { ReportListEmpty, ReportLoading, ReportPanel } from "./reportPanel";

type KindRow = TreasuryReport["byKind"][number];

function TreasuryStats({ r }: { r: TreasuryReport }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile index={0} icon={<IconWallet />} label="رصيد أول الفترة">
        <Money amount={r.opening} className="text-lg" />
      </StatTile>
      <StatTile
        index={1}
        icon={<IconArrowDownLeft />}
        label="إجمالي الداخل"
        tone="success"
      >
        <Money amount={r.totalIn} className="text-lg" />
      </StatTile>
      <StatTile
        index={2}
        icon={<IconArrowUpRight />}
        label="إجمالي الخارج"
        tone="danger"
      >
        <Money amount={r.totalOut} className="text-lg" />
      </StatTile>
      <StatTile index={3} icon={<IconWallet />} label="رصيد آخر الفترة">
        <Money amount={r.closing} className="text-lg" />
      </StatTile>
    </div>
  );
}

function KindListRow({ k }: { k: KindRow }) {
  const isIn = k.direction === "in";
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="flex items-center gap-2">
        {isIn ? (
          <IconArrowDownLeft className="size-4 text-success" />
        ) : (
          <IconArrowUpRight className="size-4 text-destructive" />
        )}
        {cashKindLabel(k.kind)}
        <span className="text-muted-foreground">({k.count})</span>
      </span>
      <span className={isIn ? "text-success" : "text-destructive"}>
        {isIn ? "+" : "−"} <Money amount={k.total} className="text-xs" />
      </span>
    </li>
  );
}

export function TreasuryReportTab({ range }: { range: DateRange }) {
  const q = useTreasuryReport(range);
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;

  return (
    <div className="space-y-4">
      <TreasuryStats r={r} />

      {r.byKind.length > 0 && (
        <ChartCard
          title="من أين دخلت الأموال وأين خرجت؟"
          subtitle="الأخضر داخل الخزنة والأحمر خارجها"
        >
          <RankBarChart
            valueLabel="المبلغ"
            items={treasuryKindItems(r.byKind)}
          />
        </ChartCard>
      )}

      <ReportPanel title="ملخص الخزنة حسب النوع">
        <ul className="divide-y">
          {r.byKind.length === 0 && <ReportListEmpty text="لا توجد حركات" />}
          {r.byKind.map((k) => (
            <KindListRow key={kindRowKey(k)} k={k} />
          ))}
        </ul>
      </ReportPanel>
    </div>
  );
}
