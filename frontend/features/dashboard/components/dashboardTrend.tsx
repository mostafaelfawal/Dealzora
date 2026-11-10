"use client";

import { useState } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { ColumnChart } from "@/components/shared/charts/MiscCharts";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";

import { TREND_METRICS } from "../config/dashboardOptions";
import { hourlySeries, trendSeries } from "../lib/dashboardSeries";
import type { Overview, TrendMetric } from "../types/dashboard";

const CARD_CLASS = "lg:col-span-2";

/** في يوم واحد يكون الاتجاه اليومي نقطة واحدة بلا معنى، فنعرض المبيعات حسب الساعة. */
function HourlySalesCard({ heatmap }: { heatmap: Overview["heatmap"] }) {
  return (
    <ChartCard
      index={1}
      title="المبيعات حسب الساعة"
      subtitle="العمود الأغمق = ساعة الذروة. وزّع الكاشير والبضاعة عليها."
      className={CARD_CLASS}
    >
      {heatmap.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات في هذا اليوم بعد" height={240} />
      ) : (
        <ColumnChart
          data={hourlySeries(heatmap)}
          valueLabel="المبيعات"
          height={240}
        />
      )}
    </ChartCard>
  );
}

function PeriodTrendCard({ trend }: { trend: Overview["trend"] }) {
  const [metric, setMetric] = useState<TrendMetric>("net");
  const label = TREND_METRICS.find((m) => m.id === metric)!.label;
  const isCount = metric === "invoices";

  return (
    <ChartCard
      index={1}
      title="اتجاه المبيعات"
      subtitle="الفترة الحالية مقابل نفس عدد الأيام قبلها"
      action={
        <SegmentedTabs
          label="المقياس"
          items={TREND_METRICS}
          value={metric}
          onChange={setMetric}
        />
      }
      className={CARD_CLASS}
    >
      <TrendChart
        data={trendSeries(trend, metric)}
        currentLabel={`${label} (الحالية)`}
        previousLabel={isCount ? undefined : `${label} (السابقة)`}
        kind={isCount ? "count" : "money"}
        height={260}
      />
    </ChartCard>
  );
}

export function DashboardTrend({
  o,
  singleDay,
}: {
  o: Overview;
  singleDay: boolean;
}) {
  return singleDay ? (
    <HourlySalesCard heatmap={o.heatmap} />
  ) : (
    <PeriodTrendCard trend={o.trend} />
  );
}
