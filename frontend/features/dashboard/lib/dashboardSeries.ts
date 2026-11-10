import type { SparkPoint } from "@/components/shared/charts/MiscCharts";
import { formatDate, formatShortDate, formatWeekday } from "@/lib/dates";

import {
  DEFAULT_HOURS,
  SHORT_DATE_THRESHOLD,
} from "../config/dashboardOptions";
import type { Overview, TrendDay, TrendMetric } from "../types/dashboard";

/**
 * تحويلات بيانات اللوحة إلى صيغ جاهزة للرسوم.
 * دوال نقية بلا React حتى تكون سهلة الاختبار وإعادة الاستخدام.
 */

export const greeting = (now = new Date()) =>
  now.getHours() < 12 ? "صباح الخير" : "مساء الخير";

/** تسمية محور الأيام: اسم اليوم للفترات القصيرة، والتاريخ المختصر للطويلة. */
const dayAxisLabel = (day: number, length: number) =>
  length > SHORT_DATE_THRESHOLD ? formatShortDate(day) : formatWeekday(day);

/** "3م" / "11ص" */
const shortHourLabel = (h: number) =>
  `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "ص" : "م"}`;

/** نقاط خط الاتجاه لبطاقة KPI: قيمة اليوم + نفس اليوم في الفترة السابقة. */
export function sparkPoints(
  trend: TrendDay[],
  pick: (t: TrendDay) => number,
  prevPick?: (t: TrendDay) => number,
): SparkPoint[] {
  return trend.map((t) => ({
    label: formatDate(t.day),
    value: pick(t),
    previous: prevPick?.(t),
  }));
}

const METRIC_PICKERS: Record<
  TrendMetric,
  { current: (t: TrendDay) => number; previous: (t: TrendDay) => number }
> = {
  net: { current: (t) => t.net, previous: (t) => t.prevNet },
  profit: { current: (t) => t.profit, previous: (t) => t.prevProfit },
  invoices: { current: (t) => t.invoices, previous: () => 0 },
};

/** سلسلة "الفترة الحالية مقابل السابقة" للمقياس المختار. */
export function trendSeries(trend: TrendDay[], metric: TrendMetric) {
  const pick = METRIC_PICKERS[metric];
  return trend.map((t) => ({
    key: String(t.day),
    label: dayAxisLabel(t.day, trend.length),
    title: formatDate(t.day),
    current: pick.current(t),
    previous: pick.previous(t),
  }));
}

/** مبيعات كل ساعة (تجميع خريطة الذروة على كل أيام الفترة)، بلا فجوات بين أول وآخر ساعة. */
export function hourlySeries(heatmap: Overview["heatmap"]) {
  const byHour = new Map<number, { net: number; invoices: number }>();
  for (const cell of heatmap) {
    const cur = byHour.get(cell.hour) ?? { net: 0, invoices: 0 };
    byHour.set(cell.hour, {
      net: cur.net + cell.net,
      invoices: cur.invoices + cell.invoices,
    });
  }

  const hours = [...byHour.keys()];
  const from = hours.length ? Math.min(...hours) : DEFAULT_HOURS.from;
  const to = hours.length ? Math.max(...hours) : DEFAULT_HOURS.to;

  return Array.from({ length: to - from + 1 }, (_, i) => {
    const hour = from + i;
    const slot = byHour.get(hour);
    const label = shortHourLabel(hour);
    return {
      key: String(hour),
      label,
      title: `الساعة ${label} · ${slot?.invoices ?? 0} فاتورة`,
      value: slot?.net ?? 0,
    };
  });
}

/** الداخل والخارج من الخزنة يومياً. */
export function cashFlowSeries(cashFlow: Overview["cashFlow"]) {
  return cashFlow.map((c) => ({
    key: String(c.day),
    label: dayAxisLabel(c.day, cashFlow.length),
    title: formatDate(c.day),
    inflow: c.cashIn,
    outflow: c.cashOut,
  }));
}

/** نسبة الخصم من قيمة البيع قبل الخصم. */
export const discountSharePct = (netSales: number, discounts: number) =>
  netSales > 0 ? Math.round((discounts / (netSales + discounts)) * 100) : null;
