"use client";

import {
  IconCash,
  IconCoin,
  IconReceipt,
  IconWallet,
} from "@tabler/icons-react";
import { useState } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { CHART } from "@/components/shared/charts/chartTheme";
import { Donut } from "@/components/shared/charts/MiscCharts";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import type { DateRange } from "@/lib/dates";
import { formatDayLabel } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SALES_METRICS } from "../config/reportOptions";
import { useSalesReport } from "../hooks/useReports";
import {
  activeDaysDesc,
  marginPct,
  salesTrendSeries,
} from "../lib/reportSeries";
import type { SalesMetric, SalesReport } from "../types/report";
import {
  ReportLoading,
  ReportPanel,
  ReportTableHead,
  reportTd as td,
} from "./reportPanel";

const DAY_COLUMNS = [
  "اليوم",
  "الفواتير",
  "المبيعات",
  "المرتجع",
  "الصافي",
  "التكلفة",
  "الربح",
];

const Cell = ({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) => (
  <td className={td}>
    <Money amount={amount} className={cn("text-xs", className)} />
  </td>
);

function SalesStats({ r }: { r: SalesReport }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconReceipt />}
        label="صافي المبيعات"
        hint={`${r.count} فاتورة · خصومات ${formatNumber(r.discounts)}`}
      >
        <Money amount={r.net} className="text-lg" />
      </StatTile>
      <StatTile
        index={1}
        icon={<IconCoin />}
        label="مجمل الربح"
        tone="success"
        hint={`هامش ${marginPct(r.profit, r.net)}%`}
      >
        <Money amount={r.profit} className="text-lg" />
      </StatTile>
      <StatTile index={2} icon={<IconCash />} label="المصروفات" tone="warning">
        <Money amount={r.expenses} className="text-lg" />
      </StatTile>
      <StatTile
        index={3}
        icon={<IconWallet />}
        label="صافي الربح بعد المصروفات"
        tone={r.netProfit < 0 ? "danger" : "success"}
      >
        <Money
          amount={r.netProfit}
          className={cn("text-lg", r.netProfit < 0 && "text-destructive")}
        />
      </StatTile>
    </div>
  );
}

function SalesTrendCard({ r }: { r: SalesReport }) {
  const [metric, setMetric] = useState<SalesMetric>("net");
  const isEmpty = r.count === 0 && r.returns === 0;

  return (
    <ChartCard
      title="اتجاه الفترة"
      subtitle="مرّر على أي يوم لرؤية الرقم"
      action={
        <SegmentedTabs
          label="المقياس"
          items={SALES_METRICS}
          value={metric}
          onChange={setMetric}
        />
      }
      className="lg:col-span-2"
    >
      {isEmpty ? (
        <ChartEmpty text="لا توجد مبيعات في هذه الفترة" height={260} />
      ) : (
        <TrendChart
          data={salesTrendSeries(r.days, metric)}
          currentLabel={SALES_METRICS.find((m) => m.id === metric)!.label}
          kind={metric === "count" ? "count" : "money"}
          height={260}
        />
      )}
    </ChartCard>
  );
}

function PaymentSplitCard({ r }: { r: SalesReport }) {
  return (
    <ChartCard
      title="طريقة الدفع"
      subtitle="الكاش سيولة الآن، والآجل يحتاج تحصيلاً"
    >
      <Donut
        slices={[
          { key: "cash", label: "كاش", value: r.cash, color: CHART.main },
          { key: "credit", label: "آجل", value: r.credit, color: CHART.muted },
        ]}
        centerLabel="المبيعات"
        centerValue={formatNumber(r.cash + r.credit)}
      />
    </ChartCard>
  );
}

function SalesDaysTable({ r }: { r: SalesReport }) {
  return (
    <ReportPanel title="تفاصيل الأيام">
      <div className="overflow-x-auto">
        <table className="w-full min-w-160">
          <ReportTableHead columns={DAY_COLUMNS} />
          <tbody>
            {activeDaysDesc(r.days).map((d) => (
              <tr key={d.day} className="border-b last:border-0">
                <td className={td}>{formatDayLabel(d.day)}</td>
                <td className={cn(td, "font-mono")}>{d.count}</td>
                <Cell amount={d.revenue} />
                {d.returns ? (
                  <Cell amount={d.returns} className="text-destructive" />
                ) : (
                  <td className={td}>—</td>
                )}
                <Cell amount={d.net} />
                <Cell amount={d.cost} />
                <Cell
                  amount={d.profit}
                  className={d.profit < 0 ? "text-destructive" : "text-success"}
                />
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 font-semibold">
            <tr>
              <td className={td}>الإجمالي</td>
              <td className={cn(td, "font-mono")}>{r.count}</td>
              <Cell amount={r.revenue} />
              <Cell amount={r.returns} />
              <Cell amount={r.net} />
              <Cell amount={r.cost} />
              <Cell amount={r.profit} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        كاش <Money amount={r.cash} className="text-[11px]" /> · آجل{" "}
        <Money amount={r.credit} className="text-[11px]" />. الربح = صافي
        المبيعات − تكلفة البضاعة المباعة (بمتوسط سعر الشراء وقت البيع).
      </p>
    </ReportPanel>
  );
}

export function SalesReportTab({ range }: { range: DateRange }) {
  const q = useSalesReport(range);
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;

  return (
    <div className="space-y-4">
      <SalesStats r={r} />
      <div className="grid gap-4 lg:grid-cols-3">
        <SalesTrendCard r={r} />
        <PaymentSplitCard r={r} />
      </div>
      <SalesDaysTable r={r} />
    </div>
  );
}
