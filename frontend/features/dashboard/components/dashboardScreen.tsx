"use client";

import {
  IconAlertTriangle,
  IconBox,
  IconBulb,
  IconCash,
  IconChartLine,
  IconCoin,
  IconPlus,
  IconReceipt,
  IconReceiptRefund,
  IconShoppingBag,
  IconShoppingCartPlus,
  IconTrendingDown,
  IconTrendingUp,
  IconTruckDelivery,
  IconWallet,
} from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { CHART } from "@/components/shared/charts/chartTheme";
import {
  CashFlowChart,
  ColumnChart,
  Donut,
  PeakHeatmap,
} from "@/components/shared/charts/MiscCharts";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { Money } from "@/components/shared/Money";
import { listItem, MotionLi, ProgressBar } from "@/components/shared/motion";
import {
  PeriodPicker,
  periodOf,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SHORTCUTS } from "@/config/shortcuts";
import { PAYMENT_LABEL } from "@/features/sales/config/saleOptions";
import { useSessionUser } from "@/hooks/useShellData";
import {
  formatDate,
  formatShortDate,
  formatWeekday,
  formatWhen,
  parseIsoDay,
} from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatNumber, formatQty, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useOverview } from "../hooks/useOverview";
import { buildInsights, marginPct } from "../lib/insights";
import type { Overview, TrendMetric } from "../types/dashboard";
import { KpiCard } from "./kpiCard";

const METRICS: { id: TrendMetric; label: string }[] = [
  { id: "net", label: "صافي المبيعات" },
  { id: "profit", label: "مجمل الربح" },
  { id: "invoices", label: "عدد الفواتير" },
];

const greeting = () =>
  new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";

/* ================= أقسام اللوحة ================= */

function KpiGrid({ o }: { o: Overview }) {
  const k = o.kpis;
  const prev = o.prev;
  // نقاط خط الاتجاه لكل بطاقة: التاريخ + قيمة اليوم + نفس اليوم في الفترة السابقة.
  const points = (
    pick: (t: Overview["trend"][number]) => number,
    prevPick?: (t: Overview["trend"][number]) => number,
  ) =>
    o.trend.map((t) => ({
      label: formatDate(t.day),
      value: pick(t),
      previous: prevPick?.(t),
    }));
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <KpiCard
        index={0}
        icon={<IconReceipt />}
        label="صافي المبيعات"
        current={k.netSales}
        previous={prev.netSales}
        spark={{
          points: points((t) => t.net, (t) => t.prevNet),
          note: "صافي المبيعات لكل يوم في الفترة (بعد خصم المرتجعات). مرّر على الخط لترى أي يوم.",
        }}
        hint={`كاش ${formatNumber(k.cashSales)} · آجل ${formatNumber(k.creditSales)}`}
      >
        <Money amount={k.netSales} className="text-xl" />
      </KpiCard>
      <KpiCard
        index={1}
        icon={<IconCoin />}
        label="مجمل الربح"
        current={k.grossProfit}
        previous={prev.grossProfit}
        spark={{
          points: points((t) => t.profit, (t) => t.prevProfit),
          note: "الربح اليومي = المبيعات − تكلفة البضاعة المباعة (قبل المصروفات).",
        }}
        hint={`هامش ${marginPct(k)}% من المبيعات`}
      >
        <Money amount={k.grossProfit} className="text-xl" />
      </KpiCard>
      <KpiCard
        index={2}
        icon={k.netProfit >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
        label="صافي الربح بعد المصروفات"
        current={k.netProfit}
        previous={prev.netProfit}
        hint={`المصروفات ${formatNumber(k.expenses)}`}
      >
        <Money
          amount={k.netProfit}
          className={cn("text-xl", k.netProfit < 0 && "text-destructive")}
        />
      </KpiCard>
      <KpiCard
        index={3}
        icon={<IconShoppingBag />}
        label="عدد الفواتير"
        current={k.invoices}
        previous={prev.invoices}
        spark={{
          points: points((t) => t.invoices),
          note: "عدد فواتير البيع في كل يوم. انخفاضه مع ثبات المبيعات = فواتير أكبر.",
          kind: "count",
        }}
        hint={`${formatQty(k.itemsSold)} وحدة مباعة`}
      >
        <span className="font-mono">{k.invoices}</span>
      </KpiCard>
      <KpiCard
        index={4}
        icon={<IconChartLine />}
        label="متوسط الفاتورة"
        current={k.avgTicket}
        previous={prev.avgTicket}
        hint="ارفعه بعروض الكميات والأصناف المكمّلة"
      >
        <Money amount={k.avgTicket} className="text-xl" />
      </KpiCard>
      <KpiCard
        index={5}
        icon={<IconWallet />}
        label="الخصومات الممنوحة"
        current={k.discounts}
        previous={prev.discounts}
        inverse
        hint={
          k.netSales > 0
            ? `${Math.round((k.discounts / (k.netSales + k.discounts)) * 100)}% من قيمة البيع`
            : undefined
        }
      >
        <Money amount={k.discounts} className="text-xl" />
      </KpiCard>
      <KpiCard
        index={6}
        icon={<IconReceiptRefund />}
        label="المرتجعات"
        current={k.returns}
        previous={prev.returns}
        inverse
      >
        <Money amount={k.returns} className="text-xl" />
      </KpiCard>
      <KpiCard
        index={7}
        icon={<IconCash />}
        label="المصروفات"
        current={k.expenses}
        previous={prev.expenses}
        inverse
      >
        <Money amount={k.expenses} className="text-xl" />
      </KpiCard>
    </div>
  );
}

function TrendSection({ o, singleDay }: { o: Overview; singleDay: boolean }) {
  const [metric, setMetric] = useState<TrendMetric>("net");
  const label = METRICS.find((m) => m.id === metric)!.label;

  if (singleDay) {
    // يوم واحد: الاتجاه اليومي بنقطة واحدة بلا معنى، فنعرض المبيعات حسب الساعة.
    const byHour = new Map<number, { net: number; invoices: number }>();
    for (const c of o.heatmap) {
      const cur = byHour.get(c.hour) ?? { net: 0, invoices: 0 };
      byHour.set(c.hour, {
        net: cur.net + c.net,
        invoices: cur.invoices + c.invoices,
      });
    }
    const hours = [...byHour.keys()];
    const from = hours.length ? Math.min(...hours) : 9;
    const to = hours.length ? Math.max(...hours) : 22;
    const data = Array.from({ length: to - from + 1 }, (_, i) => {
      const h = from + i;
      const v = byHour.get(h);
      const hh = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "ص" : "م"}`;
      return {
        key: String(h),
        label: hh,
        title: `الساعة ${hh} · ${v?.invoices ?? 0} فاتورة`,
        value: v?.net ?? 0,
      };
    });
    return (
      <ChartCard
        index={1}
        title="المبيعات حسب الساعة"
        subtitle="العمود الأغمق = ساعة الذروة. وزّع الكاشير والبضاعة عليها."
        className="lg:col-span-2"
      >
        {o.heatmap.length === 0 ? (
          <ChartEmpty text="لا توجد مبيعات في هذا اليوم بعد" height={240} />
        ) : (
          <ColumnChart data={data} valueLabel="المبيعات" height={240} />
        )}
      </ChartCard>
    );
  }

  const current = (t: Overview["trend"][number]) =>
    metric === "net" ? t.net : metric === "profit" ? t.profit : t.invoices;
  const previous = (t: Overview["trend"][number]) =>
    metric === "net" ? t.prevNet : metric === "profit" ? t.prevProfit : 0;
  const data = o.trend.map((t) => ({
    key: String(t.day),
    label: o.trend.length > 10 ? formatShortDate(t.day) : formatWeekday(t.day),
    title: formatDate(t.day),
    current: current(t),
    previous: previous(t),
  }));
  return (
    <ChartCard
      index={1}
      title="اتجاه المبيعات"
      subtitle="الفترة الحالية مقابل نفس عدد الأيام قبلها"
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
      <TrendChart
        data={data}
        currentLabel={`${label} (الحالية)`}
        previousLabel={metric === "invoices" ? undefined : `${label} (السابقة)`}
        kind={metric === "invoices" ? "count" : "money"}
        height={260}
      />
    </ChartCard>
  );
}

function InsightsCard({ o }: { o: Overview }) {
  const items = buildInsights(o);
  const icon = {
    good: IconTrendingUp,
    bad: IconAlertTriangle,
    info: IconBulb,
  } as const;
  return (
    <ChartCard
      index={2}
      title="ماذا تقول الأرقام؟"
      subtitle="ملاحظات تلقائية من بيانات الفترة"
    >
      {items.length === 0 ? (
        <ChartEmpty
          text="لا توجد ملاحظات بعد. ستظهر مع زيادة المبيعات."
          height={120}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const Icon = icon[it.tone];
            const body = (
              <span className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    it.tone === "good"
                      ? "text-success"
                      : it.tone === "bad"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                />
                <span>{it.text}</span>
              </span>
            );
            return (
              <MotionLi
                key={it.text}
                {...listItem(i)}
                className="text-xs leading-relaxed"
              >
                {it.href ? (
                  <Link href={it.href} className="block hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </MotionLi>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}

function CashiersTable({ o }: { o: Overview }) {
  const max = Math.max(...o.cashiers.map((c) => c.net), 0) || 1;
  return (
    <ChartCard
      index={8}
      title="أداء الكاشيرية"
      subtitle="الصافي بعد المرتجعات، ومتوسط الفاتورة، والخصومات الممنوحة"
      href="/admin/shifts"
      className="lg:col-span-2"
    >
      {o.cashiers.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات في هذه الفترة" height={120} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-130 text-xs">
            <thead className="border-b text-muted-foreground">
              <tr className="h-8">
                <th className="text-start font-normal">الكاشير</th>
                <th className="w-2/5 text-start font-normal">الصافي</th>
                <th className="text-start font-normal">الفواتير</th>
                <th className="text-start font-normal">متوسط الفاتورة</th>
                <th className="text-start font-normal">الخصومات</th>
                <th className="text-start font-normal">المرتجع</th>
              </tr>
            </thead>
            <tbody>
              {o.cashiers.map((c) => (
                <tr key={c.userId} className="h-11 border-b last:border-0">
                  <td className="font-medium">{c.name}</td>
                  <td className="pe-4">
                    <div className="space-y-1">
                      <span dir="ltr" className="font-mono">
                        {formatNumber(c.net)}
                      </span>
                      <ProgressBar
                        value={c.net / max}
                        barClassName="bg-[var(--chart-main)]"
                      />
                    </div>
                  </td>
                  <td className="font-mono">{c.invoices}</td>
                  <td dir="ltr" className="text-end font-mono sm:text-start">
                    {formatNumber(c.avgTicket)}
                  </td>
                  <td dir="ltr" className="text-end font-mono sm:text-start">
                    {formatNumber(c.discounts)}
                  </td>
                  <td
                    dir="ltr"
                    className={cn(
                      "text-end font-mono sm:text-start",
                      c.returns > 0 && "text-destructive",
                    )}
                  >
                    {formatNumber(c.returns)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function HealthCard({ o }: { o: Overview }) {
  const h = o.health;
  const rows: {
    label: string;
    value: React.ReactNode;
    tone?: "bad" | "warn";
    href: string;
  }[] = [
    {
      label: "قيمة المخزون",
      value: <Money amount={h.stockValue} className="text-xs" />,
      href: "/admin/inventory",
    },
    {
      label: "أصناف نفدت",
      value: h.outOfStock,
      tone: h.outOfStock ? "bad" : undefined,
      href: "/admin/inventory",
    },
    {
      label: "قاربت على النفاد",
      value: h.lowStock,
      tone: h.lowStock ? "warn" : undefined,
      href: "/admin/inventory",
    },
    {
      label: `راكد (${h.stagnantCount} صنف)`,
      value: <Money amount={h.stagnantValue} className="text-xs" />,
      tone: h.stagnantValue ? "warn" : undefined,
      href: "/admin/inventory",
    },
    {
      label: "ديون العملاء",
      value: <Money amount={h.customersDebt} className="text-xs" />,
      href: "/admin/customers",
    },
    {
      label: `متأخرة (${h.overdueCustomers} عميل)`,
      value: <Money amount={h.overdueDebt} className="text-xs" />,
      tone: h.overdueDebt ? "bad" : undefined,
      href: "/admin/reports",
    },
    {
      label: "مستحق للموردين",
      value: <Money amount={h.suppliersPayable} className="text-xs" />,
      href: "/admin/suppliers",
    },
    {
      label: "رصيد الخزنة الآن",
      value: (
        <Money
          amount={h.treasuryBalance}
          className={cn("text-xs", h.treasuryBalance < 0 && "text-destructive")}
        />
      ),
      href: "/admin/treasury",
    },
  ];
  return (
    <ChartCard
      index={9}
      title="صحة النشاط الآن"
      subtitle="المخزون والديون والخزنة (لا تتأثر بالفترة)"
    >
      <ul className="divide-y text-xs">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              href={r.href}
              className="flex items-center justify-between gap-3 py-2 hover:bg-muted/40"
            >
              <span className="flex items-center gap-2">
                {r.tone && (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      r.tone === "bad" ? "bg-destructive" : "bg-warning",
                    )}
                  />
                )}
                {r.label}
              </span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  r.tone === "bad" && "text-destructive",
                  r.tone === "warn" && "text-warning",
                )}
              >
                {r.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function RecentSales({ o }: { o: Overview }) {
  return (
    <ChartCard index={11} title="آخر الفواتير" href="/admin/sales">
      {o.recentSales.length === 0 ? (
        <ChartEmpty text="لا توجد فواتير بعد" height={100} />
      ) : (
        <ul className="divide-y">
          {o.recentSales.map((s, i) => (
            <MotionLi key={s.id} {...listItem(i)}>
              <Link
                href={`/admin/sales?open=${s.id}`}
                className="flex items-center gap-3 py-2 text-xs hover:bg-muted/40"
              >
                <span className="w-12 font-mono font-semibold">
                  #{s.number}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {s.customerName ?? "عميل نقدي"}
                </span>
                <span className="hidden text-muted-foreground sm:inline">
                  {PAYMENT_LABEL[s.paymentMethod]}
                </span>
                <span className="hidden w-28 text-muted-foreground md:inline">
                  {formatWhen(s.soldAt)}
                </span>
                <Money amount={s.total} className="text-xs" />
              </Link>
            </MotionLi>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

/* ================= الشاشة ================= */

/** لوحة المدير: أين أنا الآن، ما الذي تغيّر، أين الربح، ومتى الذروة، وما الذي يحتاج تصرفاً. */
export function DashboardScreen() {
  const user = useSessionUser();
  const [period, setPeriod] = useState<PeriodValue>(periodOf("week"));
  const q = useOverview(period.range);
  const o = q.data;
  const singleDay = period.range.from === period.range.to;

  const flow = useMemo(
    () =>
      (o?.cashFlow ?? []).map((c) => ({
        key: String(c.day),
        label:
          (o?.cashFlow.length ?? 0) > 10
            ? formatShortDate(c.day)
            : formatWeekday(c.day),
        title: formatDate(c.day),
        inflow: c.cashIn,
        outflow: c.cashOut,
      })),
    [o],
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">
            {greeting()}، {user.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {o?.shift
              ? `الوردية مفتوحة مع ${o.shift.cashierName ?? "—"} منذ ${formatTime(o.shift.openedAt)} · ${o.shift.salesCount} فاتورة · في الدرج ${formatNumber(o.shift.expectedCash)} ج.م`
              : "لا توجد وردية مفتوحة الآن."}
          </p>
        </div>
        <PeriodPicker
          value={period}
          onChange={setPeriod}
          presets={[
            "today",
            "yesterday",
            "week",
            "month",
            "last_month",
            "year",
            "custom",
          ]}
        />
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/pos" />}
          className="h-10 gap-2"
        >
          <IconShoppingCartPlus className="size-4" />
          بيع جديد
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {SHORTCUTS.newSale.label}
          </ShortcutBadge>
        </Button>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin/purchases/new" />}
          className="h-10 gap-2 font-normal"
        >
          <IconTruckDelivery className="size-4" />
          فاتورة شراء
        </Button>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin/products/new" />}
          className="h-10 gap-2 font-normal"
        >
          <IconPlus className="size-4" />
          صنف جديد
        </Button>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin/inventory" />}
          className="h-10 gap-2 font-normal"
        >
          <IconBox className="size-4" />
          جرد المخزون
        </Button>
      </div>

      {!o ? (
        q.isError ? (
          <div className="flex flex-col items-center gap-3 border border-dashed py-16">
            <p role="alert" className="text-sm text-destructive">
              {extractErrorMessage(q.error, "تعذّر تحميل اللوحة")}
            </p>
            <Button variant="outline" onClick={() => q.refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        )
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            q.isFetching && q.isPlaceholderData && "opacity-60",
          )}
        >
          <p className="text-[11px] text-muted-foreground">
            الفترة {formatDate(parseIsoDay(o.dateFrom))} –{" "}
            {formatDate(parseIsoDay(o.dateTo))} · المقارنة مع{" "}
            {formatDate(parseIsoDay(o.prevFrom))} –{" "}
            {formatDate(parseIsoDay(o.prevTo))}
          </p>

          <KpiGrid o={o} />

          <div className="grid gap-4 lg:grid-cols-3">
            <TrendSection o={o} singleDay={singleDay} />
            <InsightsCard o={o} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              index={3}
              title="أوقات الذروة"
              subtitle="عدد الفواتير حسب اليوم والساعة — الأغمق هو الأكثر زحاماً"
              className="lg:col-span-2"
            >
              {o.heatmap.length === 0 ? (
                <ChartEmpty text="لا توجد مبيعات في هذه الفترة" />
              ) : (
                <PeakHeatmap cells={o.heatmap} />
              )}
            </ChartCard>
            <ChartCard
              index={4}
              title="كاش أم آجل؟"
              subtitle="الآجل سيولة مؤجلة؛ تابع تحصيله"
            >
              <Donut
                slices={o.payments.map((p) => ({
                  key: p.key,
                  label: p.label,
                  value: p.value,
                  color: p.key === "cash" ? CHART.main : CHART.muted,
                }))}
                centerLabel="إجمالي المبيعات"
                centerValue={formatNumber(
                  o.payments.reduce((s, p) => s + p.value, 0),
                )}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              index={5}
              title="الأصناف الأعلى ربحاً"
              subtitle="الربح بعد المرتجع — ركّز عليها في العرض والتوفر"
              href="/admin/reports"
            >
              {o.topProducts.length === 0 ? (
                <ChartEmpty text="لا توجد مبيعات" />
              ) : (
                <RankBarChart
                  valueLabel="الربح"
                  items={o.topProducts.map((p) => ({
                    key: p.key,
                    label: p.label,
                    value: p.value,
                    extra: [{ label: "الإيراد", value: p.extra }],
                  }))}
                />
              )}
            </ChartCard>
            <ChartCard
              index={6}
              title="المبيعات حسب القسم"
              subtitle="أين يأتي الإيراد؟"
              href="/admin/products"
            >
              {o.categories.length === 0 ? (
                <ChartEmpty text="لا توجد مبيعات" />
              ) : (
                <RankBarChart
                  valueLabel="الإيراد"
                  items={o.categories.map((c) => ({
                    key: c.key,
                    label: c.label,
                    value: c.value,
                    extra: [{ label: "الربح", value: c.extra }],
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              index={7}
              title="حركة الخزنة يومياً"
              subtitle="كل ما دخل (مبيعات، تحصيل) وكل ما خرج (مشتريات، مصروفات، مرتجع)"
              href="/admin/treasury"
              className="lg:col-span-2"
            >
              {flow.every((f) => !f.inflow && !f.outflow) ? (
                <ChartEmpty text="لا توجد حركات" />
              ) : (
                <CashFlowChart data={flow} />
              )}
            </ChartCard>
            <ChartCard
              index={7}
              title="أين تذهب المصروفات؟"
              href="/admin/expenses"
            >
              {o.expensesByCategory.length === 0 ? (
                <ChartEmpty text="لا توجد مصروفات في هذه الفترة" />
              ) : (
                <RankBarChart
                  valueLabel="المبلغ"
                  items={o.expensesByCategory.map((e) => ({
                    key: e.key,
                    label: e.label,
                    value: e.value,
                    extra: [
                      { label: "عدد المرات", value: e.extra, kind: "count" },
                    ],
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <CashiersTable o={o} />
            <HealthCard o={o} />
          </div>

          <RecentSales o={o} />
        </div>
      )}
    </div>
  );
}
