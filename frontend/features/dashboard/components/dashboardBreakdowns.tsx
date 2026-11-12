"use client";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { CHART } from "@/components/shared/charts/chartTheme";
import {
  CashFlowChart,
  Donut,
  PeakHeatmap,
} from "@/components/shared/charts/MiscCharts";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { formatNumber } from "@/lib/format";

import { cashFlowSeries } from "../lib/dashboardSeries";
import type { NamedValue, Overview } from "../types/dashboard";

/**
 * بطاقات التفصيل في اللوحة: متى نبيع، كيف ندفع، ماذا نبيع، وأين يذهب المال.
 * كل بطاقة تأخذ الجزء الذي تحتاجه فقط من Overview.
 */

type RankExtra = { label: string; kind?: "money" | "count" };

/** NamedValue → عناصر RankBarChart مع عمود إضافي واحد. */
const toRankItems = (rows: NamedValue[], extra: RankExtra) =>
  rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value,
    extra: [{ ...extra, value: r.extra }],
  }));

export function PeakHoursCard({ heatmap }: { heatmap: Overview["heatmap"] }) {
  return (
    <ChartCard
      index={3}
      title="أوقات الذروة"
      subtitle="عدد الفواتير حسب اليوم والساعة — الأغمق هو الأكثر زحاماً"
      className="lg:col-span-2"
    >
      {heatmap.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات في هذه الفترة" />
      ) : (
        <PeakHeatmap cells={heatmap} />
      )}
    </ChartCard>
  );
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: CHART.main,
  credit: CHART.muted,
};
/** الطرق الإلكترونية تأخذ ألوانها بالترتيب (عددها يختلف من محل لآخر). */
const ELECTRONIC_COLORS = [
  CHART.seq[1],
  CHART.seq[3],
  CHART.seq[2],
  CHART.seq[4],
  CHART.seq[0],
];

export function PaymentsCard({ payments }: { payments: NamedValue[] }) {
  const total = payments.reduce((sum, p) => sum + p.value, 0);
  // الكاش والآجل دائماً، ثم كل طريقة إلكترونية مفعّلة (حتى لو صفر) أو استُخدمت في الفترة.
  const shown = payments;
  let e = 0;
  const colorOf = (key: string) =>
    PAYMENT_COLORS[key] ??
    ELECTRONIC_COLORS[e++ % ELECTRONIC_COLORS.length] ??
    CHART.muted;
  return (
    <ChartCard
      index={4}
      title="طرق الدفع"
      subtitle="الآجل سيولة مؤجلة؛ تابع تحصيله. المحافظ خارج الدرج."
    >
      <Donut
        slices={shown.map((p) => ({
          key: p.key,
          label: p.label,
          value: p.value,
          color: colorOf(p.key),
        }))}
        centerLabel="إجمالي المبيعات"
        centerValue={formatNumber(total)}
      />
    </ChartCard>
  );
}

export function TopProductsCard({ products }: { products: NamedValue[] }) {
  return (
    <ChartCard
      index={5}
      title="الأصناف الأعلى ربحاً"
      subtitle="الربح بعد المرتجع — ركّز عليها في العرض والتوفر"
      href="/admin/reports"
    >
      {products.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات" />
      ) : (
        <RankBarChart
          valueLabel="الربح"
          items={toRankItems(products, { label: "الإيراد" })}
        />
      )}
    </ChartCard>
  );
}

export function CategoriesCard({ categories }: { categories: NamedValue[] }) {
  return (
    <ChartCard
      index={6}
      title="المبيعات حسب القسم"
      subtitle="أين يأتي الإيراد؟"
      href="/admin/products"
    >
      {categories.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات" />
      ) : (
        <RankBarChart
          valueLabel="الإيراد"
          items={toRankItems(categories, { label: "الربح" })}
        />
      )}
    </ChartCard>
  );
}

export function CashFlowCard({ cashFlow }: { cashFlow: Overview["cashFlow"] }) {
  const hasMovement = cashFlow.some((c) => c.cashIn || c.cashOut);
  return (
    <ChartCard
      index={7}
      title="حركة الخزنة يومياً"
      subtitle="كل ما دخل (مبيعات، تحصيل) وكل ما خرج (مشتريات، مصروفات، مرتجع)"
      href="/admin/treasury"
      className="lg:col-span-2"
    >
      {hasMovement ? (
        <CashFlowChart data={cashFlowSeries(cashFlow)} />
      ) : (
        <ChartEmpty text="لا توجد حركات" />
      )}
    </ChartCard>
  );
}

export function ExpensesBreakdownCard({
  expenses,
}: {
  expenses: NamedValue[];
}) {
  return (
    <ChartCard index={8} title="أين تذهب المصروفات؟" href="/admin/expenses">
      {expenses.length === 0 ? (
        <ChartEmpty text="لا توجد مصروفات في هذه الفترة" />
      ) : (
        <RankBarChart
          valueLabel="المبلغ"
          items={toRankItems(expenses, { label: "عدد المرات", kind: "count" })}
        />
      )}
    </ChartCard>
  );
}
