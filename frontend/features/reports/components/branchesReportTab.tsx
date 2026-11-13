"use client";

import {
  IconBuildingStore,
  IconCash,
  IconCoin,
  IconReceipt,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import type { DateRange } from "@/lib/dates";
import {
  formatDate,
  formatShortDate,
  formatWeekday,
  formatWhen,
} from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  fetchCombinedReport,
  type BranchTotals,
  type CombinedReport,
} from "../api/branchesReport.api";
import { marginPct } from "../lib/reportSeries";
import {
  ReportLoading,
  ReportPanel,
  ReportTableHead,
  reportTd as td,
} from "./reportPanel";

type Metric = "net" | "profit" | "netProfit" | "count";

const METRICS: { id: Metric; label: string }[] = [
  { id: "net", label: "صافي المبيعات" },
  { id: "profit", label: "مجمل الربح" },
  { id: "netProfit", label: "صافي الربح" },
  { id: "count", label: "عدد الفواتير" },
];

const pick = (b: BranchTotals, m: Metric) =>
  m === "count"
    ? b.count
    : m === "netProfit"
      ? b.netProfit
      : m === "profit"
        ? b.profit
        : b.net;

const COLUMNS = [
  "الفرع",
  "الفواتير",
  "صافي المبيعات",
  "المرتجع",
  "مجمل الربح",
  "المصروفات",
  "صافي الربح",
  "آخر تحديث",
];

function Totals({ r }: { r: CombinedReport }) {
  const t = r.totals;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconReceipt />}
        label="صافي مبيعات المحل"
        hint={`${t.count} فاتورة في ${r.branches.length} فرع`}
      >
        <Money amount={t.net} className="text-lg" />
      </StatTile>
      <StatTile
        index={1}
        icon={<IconCoin />}
        label="مجمل الربح"
        tone="success"
        hint={`هامش ${marginPct(t.profit, t.net)}%`}
      >
        <Money amount={t.profit} className="text-lg" />
      </StatTile>
      <StatTile
        index={2}
        icon={<IconCash />}
        label="مصروفات الفروع"
        tone="warning"
      >
        <Money amount={t.expenses} className="text-lg" />
      </StatTile>
      <StatTile
        index={3}
        icon={<IconWallet />}
        label="صافي الربح بعد المصروفات"
        tone={t.netProfit < 0 ? "danger" : "success"}
      >
        <Money
          amount={t.netProfit}
          className={cn("text-lg", t.netProfit < 0 && "text-destructive")}
        />
      </StatTile>
    </div>
  );
}

function Comparison({ r }: { r: CombinedReport }) {
  const [metric, setMetric] = useState<Metric>("net");
  const items = r.branches
    .map((b) => ({ key: b.id, label: b.name, value: pick(b, metric) }))
    .sort((a, b) => b.value - a.value);
  const days = r.days;
  const trend = days.map((d) => ({
    key: String(d.day),
    label: days.length > 14 ? formatShortDate(d.day) : formatWeekday(d.day),
    title: `${formatDate(d.day)} · ${d.count} فاتورة`,
    current:
      metric === "count"
        ? d.count
        : metric === "netProfit"
          ? d.profit - d.expenses
          : metric === "profit"
            ? d.profit
            : d.net,
  }));
  const empty =
    r.totals.count === 0 && r.totals.returns === 0 && r.totals.expenses === 0;
  const label = METRICS.find((m) => m.id === metric)!.label;
  const kind = metric === "count" ? "count" : "money";

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <ChartCard
        title="مقارنة الفروع"
        subtitle="الأعلى أولاً"
        action={
          <SegmentedTabs
            label="المقياس"
            items={METRICS}
            value={metric}
            onChange={setMetric}
          />
        }
        className="lg:col-span-2"
      >
        {empty ? (
          <ChartEmpty
            text="لا توجد حركة في الفروع خلال هذه الفترة"
            height={220}
          />
        ) : (
          <RankBarChart items={items} valueLabel={label} kind={kind} />
        )}
      </ChartCard>
      <ChartCard
        title="اتجاه المحل كله"
        subtitle="مجموع كل الفروع يوماً بيوم"
        className="lg:col-span-3"
      >
        {empty ? (
          <ChartEmpty text="لا توجد حركة في هذه الفترة" height={260} />
        ) : (
          <TrendChart
            data={trend}
            currentLabel={label}
            kind={kind}
            height={260}
          />
        )}
      </ChartCard>
    </div>
  );
}

function Cell({ v, tone }: { v: number; tone?: string }) {
  return (
    <td className={td}>
      <Money amount={v} className={cn("text-xs", tone)} />
    </td>
  );
}

function BranchesTable({ r }: { r: CombinedReport }) {
  return (
    <ReportPanel title="تفاصيل الفروع">
      <div className="overflow-x-auto">
        <table className="w-full min-w-180">
          <ReportTableHead columns={COLUMNS} />
          <tbody>
            {r.branches.map((b) => (
              <tr
                key={b.id}
                className={cn(
                  "border-b last:border-0",
                  !b.isActive && "opacity-60",
                )}
              >
                <td className={td}>
                  <span className="flex items-center gap-1.5">
                    <IconBuildingStore className="size-3.5 text-muted-foreground" />
                    {b.name}
                    {b.isMe && (
                      <span className="bg-primary/10 px-1 text-[10px] text-primary">
                        الرئيسي
                      </span>
                    )}
                    {!b.isActive && (
                      <span className="bg-muted px-1 text-[10px]">موقوف</span>
                    )}
                  </span>
                </td>
                <td className={cn(td, "font-mono")}>{formatNumber(b.count)}</td>
                <Cell v={b.net} />
                {b.returns ? (
                  <Cell v={b.returns} tone="text-destructive" />
                ) : (
                  <td className={td}>—</td>
                )}
                <Cell
                  v={b.profit}
                  tone={b.profit < 0 ? "text-destructive" : "text-success"}
                />
                <Cell v={b.expenses} />
                <Cell
                  v={b.netProfit}
                  tone={b.netProfit < 0 ? "text-destructive" : undefined}
                />
                <td className={cn(td, "text-muted-foreground")}>
                  {b.lastUpdate
                    ? formatWhen(Date.parse(b.lastUpdate))
                    : "لم يرفع بعد"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 font-semibold">
            <tr>
              <td className={td}>المحل كله</td>
              <td className={cn(td, "font-mono")}>
                {formatNumber(r.totals.count)}
              </td>
              <Cell v={r.totals.net} />
              <Cell v={r.totals.returns} />
              <Cell v={r.totals.profit} />
              <Cell v={r.totals.expenses} />
              <Cell v={r.totals.netProfit} />
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        كل فرع يرفع ملخص أيامه مع المزامنة (كل دقيقة تقريباً). فرع غير متصل
        بالإنترنت تظهر أرقامه حتى آخر تحديث، وتكتمل فور اتصاله. أرقام مجمّعة فقط:
        فواتير الفروع نفسها تبقى على أجهزتها.
      </p>
    </ReportPanel>
  );
}

/** التقرير المجمّع لكل الفروع (للمالك من الجهاز الرئيسي). */
export function BranchesReportTab({ range }: { range: DateRange }) {
  const q = useQuery({
    queryKey: ["reports", "branches", range.from, range.to],
    queryFn: () => fetchCombinedReport(range),
    refetchInterval: 60_000,
    retry: false,
  });
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-4">
      <Totals r={q.data} />
      <Comparison r={q.data} />
      <BranchesTable r={q.data} />
    </div>
  );
}
