import { CHART } from "@/components/shared/charts/chartTheme";
import { KIND_LABEL } from "@/features/treasury/config/treasuryOptions";
import type { CashKind } from "@/features/treasury/types/treasury";
import { formatDate, formatShortDate, formatWeekday } from "@/lib/dates";

import { REPORT_LIMITS, SHORT_DATE_THRESHOLD } from "../config/reportOptions";
import type {
  DebtsReport,
  ProductRank,
  ProductRow,
  SalesDay,
  SalesMetric,
  TreasuryReport,
} from "../types/report";

/** تحويلات بيانات التقارير إلى صيغ جاهزة للرسوم والجداول. دوال نقية بلا React. */

export const marginPct = (profit: number, net: number) =>
  net > 0 ? Math.round((profit / net) * 100) : 0;

const pickSalesMetric: Record<SalesMetric, (d: SalesDay) => number> = {
  net: (d) => d.net,
  profit: (d) => d.profit,
  count: (d) => d.count,
};

export function salesTrendSeries(days: SalesDay[], metric: SalesMetric) {
  const pick = pickSalesMetric[metric];
  return days.map((d) => ({
    key: String(d.day),
    label:
      days.length > SHORT_DATE_THRESHOLD
        ? formatShortDate(d.day)
        : formatWeekday(d.day),
    title: `${formatDate(d.day)} · ${d.count} فاتورة`,
    current: pick(d),
  }));
}

/** الأيام التي فيها حركة فقط، الأحدث أولاً. */
export const activeDaysDesc = (days: SalesDay[]) =>
  [...days].reverse().filter((d) => d.count || d.returns);

const pickProductMetric: Record<ProductRank, (r: ProductRow) => number> = {
  top: (r) => r.qty,
  bottom: (r) => r.qty,
  profit: (r) => r.profit,
  revenue: (r) => r.revenue,
};

export const isQtyRank = (rank: ProductRank) =>
  rank === "top" || rank === "bottom";

export function productRankItems(rows: ProductRow[], rank: ProductRank) {
  return rows.slice(0, REPORT_LIMITS.productsChart).map((r) => ({
    key: r.productId,
    label: r.name,
    value: pickProductMetric[rank](r),
    extra: [
      { label: "الإيراد", value: r.revenue },
      { label: "الربح", value: r.profit },
      { label: `الكمية (${r.unit})`, value: r.qty, kind: "qty" as const },
    ],
  }));
}

/** أكبر N عناصر حسب قيمة رقمية، بدون تعديل المصفوفة الأصلية. */
export const topBy = <T>(rows: T[], value: (row: T) => number, n: number) =>
  [...rows].sort((a, b) => value(b) - value(a)).slice(0, n);

export function topDebtorItems(customers: DebtsReport["customers"]) {
  return topBy(customers, (c) => c.balance, REPORT_LIMITS.topChart).map(
    (c) => ({
      key: c.id,
      label: c.isOverdue ? `${c.name} (متأخر)` : c.name,
      value: c.balance,
      color: c.isOverdue ? CHART.bad : undefined,
      extra: [{ label: "الحد الائتماني", value: c.creditLimit }],
    }),
  );
}

type KindRow = TreasuryReport["byKind"][number];

export const cashKindLabel = (kind: string) =>
  KIND_LABEL[kind as CashKind] ?? kind;

export const kindRowKey = (k: KindRow) => `${k.kind}-${k.direction}`;

export function treasuryKindItems(byKind: KindRow[]) {
  return byKind.map((k) => ({
    key: kindRowKey(k),
    label: `${cashKindLabel(k.kind)} (${k.direction === "in" ? "داخل" : "خارج"})`,
    value: k.total,
    color: k.direction === "in" ? CHART.good : CHART.bad,
    extra: [{ label: "عدد الحركات", value: k.count, kind: "count" as const }],
  }));
}
