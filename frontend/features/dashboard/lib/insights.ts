import { WEEKDAYS } from "@/components/shared/charts/MiscCharts";
import { formatDayLabel } from "@/lib/dates";
import { formatMoneyText } from "@/lib/format";

import type { Kpis, Overview } from "../types/dashboard";

export type InsightTone = "good" | "bad" | "info";
export interface Insight {
  tone: InsightTone;
  text: string;
  href?: string;
}

/** نسبة التغيّر عن الفترة السابقة. null لو لا توجد قاعدة للمقارنة. */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export const marginPct = (k: Kpis) =>
  k.netSales > 0 ? Math.round((k.grossProfit / k.netSales) * 100) : 0;

const hourLabel = (h: number) =>
  `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? " صباحاً" : " مساءً"}`;

/**
 * ملاحظات مكتوبة بلغة التاجر من نفس الأرقام: ما الذي تغيّر، وأين الفرصة، وما الذي يحتاج تصرفاً.
 * مرتبة بالأهمية ومحدودة العدد حتى لا تتحول لضوضاء.
 */
export function buildInsights(o: Overview, max = 6): Insight[] {
  const out: Insight[] = [];
  const k = o.kpis;

  const salesChange = changePct(k.netSales, o.prev.netSales);
  if (salesChange !== null && Math.abs(salesChange) >= 5)
    out.push({
      tone: salesChange > 0 ? "good" : "bad",
      text: `المبيعات ${salesChange > 0 ? "أعلى" : "أقل"} بـ ${Math.abs(salesChange)}% من الفترة السابقة.`,
    });

  const margin = marginPct(k);
  const prevMargin = marginPct(o.prev);
  if (
    k.netSales > 0 &&
    o.prev.netSales > 0 &&
    Math.abs(margin - prevMargin) >= 3
  )
    out.push({
      tone: margin > prevMargin ? "good" : "bad",
      text: `هامش الربح ${margin}% مقابل ${prevMargin}% سابقاً${margin < prevMargin ? " — راجع الخصومات وأسعار الشراء." : "."}`,
    });

  if (k.netProfit < 0 && k.netSales > 0)
    out.push({
      tone: "bad",
      text: `المصروفات (${formatMoneyText(k.expenses)}) أكبر من مجمل الربح في هذه الفترة.`,
      href: "/admin/expenses",
    });

  if (o.health.outOfStock > 0)
    out.push({
      tone: "bad",
      text: `${o.health.outOfStock} صنف نفد من المخزون — مبيعات ضائعة محتملة.`,
      href: "/admin/inventory",
    });

  if (o.health.overdueCustomers > 0)
    out.push({
      tone: "bad",
      text: `${o.health.overdueCustomers} عميل متأخر بمبلغ ${formatMoneyText(o.health.overdueDebt)}.`,
      href: "/admin/reports",
    });

  const best = [...o.trend].sort((a, b) => b.net - a.net)[0];
  if (best && best.net > 0 && o.trend.length > 1)
    out.push({
      tone: "info",
      text: `أفضل يوم: ${formatDayLabel(best.day)} بصافي ${formatMoneyText(best.net)}.`,
    });

  if (o.heatmap.length > 0) {
    const byHour = new Map<number, number>();
    for (const c of o.heatmap)
      byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.invoices);
    const [peakHour] = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
    const byDay = new Map<number, number>();
    for (const c of o.heatmap)
      byDay.set(c.weekday, (byDay.get(c.weekday) ?? 0) + c.net);
    const [peakDay] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      tone: "info",
      text: `الذروة حوالي ${hourLabel(peakHour)}${o.trend.length >= 7 ? `، وأقوى أيامك ${WEEKDAYS[peakDay]}` : ""} — جهّز الكاشير والبضاعة قبلها.`,
    });
  }

  if (o.health.stagnantValue > 0)
    out.push({
      tone: "info",
      text: `${formatMoneyText(o.health.stagnantValue)} مجمّدة في ${o.health.stagnantCount} صنف راكد — فكّر في عرض أو خصم.`,
      href: "/admin/inventory",
    });

  if (k.netSales > 0 && k.returns / (k.netSales + k.returns) > 0.05)
    out.push({
      tone: "bad",
      text: `المرتجعات ${Math.round((k.returns / (k.netSales + k.returns)) * 100)}% من المبيعات — راجع أسبابها.`,
      href: "/admin/returns",
    });

  return out.slice(0, max);
}
