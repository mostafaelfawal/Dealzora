"use client";

import {
  IconAlertTriangle,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCash,
  IconCoin,
  IconPrinter,
  IconReceipt,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { CHART } from "@/components/shared/charts/chartTheme";
import { Donut } from "@/components/shared/charts/MiscCharts";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  PeriodPicker,
  periodOf,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockReport } from "@/features/inventory/hooks/useInventory";
import { KIND_LABEL } from "@/features/treasury/config/treasuryOptions";
import type { CashKind } from "@/features/treasury/types/treasury";
import {
  formatDate,
  formatDayLabel,
  formatShortDate,
  formatWeekday,
} from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatNumber, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  fetchDebtsReport,
  fetchProductsReport,
  fetchSalesReport,
  fetchTreasuryReport,
} from "../api/reports.api";
import type { ProductRank, ReportTab } from "../types/report";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "sales", label: "المبيعات والأرباح" },
  { id: "products", label: "الأصناف" },
  { id: "stock", label: "النواقص والراكد" },
  { id: "debts", label: "المديونيات" },
  { id: "treasury", label: "الخزنة" },
];

const RANKS: { id: ProductRank; label: string }[] = [
  { id: "top", label: "الأكثر مبيعاً" },
  { id: "profit", label: "الأعلى ربحاً" },
  { id: "revenue", label: "الأعلى إيراداً" },
  { id: "bottom", label: "الأقل مبيعاً" },
];

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3 border bg-card p-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Loading({
  error,
  onRetry,
}: {
  error?: unknown;
  onRetry?: () => void;
}) {
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed py-12 text-center">
        <p role="alert" className="text-sm text-destructive">
          {extractErrorMessage(error, "تعذّر تحميل التقرير")}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        )}
      </div>
    );
  return (
    <div className="space-y-2">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

const th = "h-9 px-3 text-start text-xs font-normal text-muted-foreground";
const td = "h-10 px-3 text-xs";

/* ================= المبيعات والأرباح ================= */
const METRICS: { id: "net" | "profit" | "count"; label: string }[] = [
  { id: "net", label: "صافي المبيعات" },
  { id: "profit", label: "مجمل الربح" },
  { id: "count", label: "عدد الفواتير" },
];

function SalesTab({ period }: { period: PeriodValue }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("net");
  const q = useQuery({
    queryKey: ["reports", "sales", period.range],
    queryFn: () => fetchSalesReport(period.range),
  });
  if (!q.data) return <Loading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const margin = r.net > 0 ? Math.round((r.profit / r.net) * 100) : 0;
  return (
    <div className="space-y-4">
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
          hint={`هامش ${margin}%`}
        >
          <Money amount={r.profit} className="text-lg" />
        </StatTile>
        <StatTile
          index={2}
          icon={<IconCash />}
          label="المصروفات"
          tone="warning"
        >
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

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="اتجاه الفترة"
          subtitle="مرّر على أي يوم لرؤية الرقم"
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
          {r.count === 0 && r.returns === 0 ? (
            <ChartEmpty text="لا توجد مبيعات في هذه الفترة" height={260} />
          ) : (
            <TrendChart
              data={r.days.map((d) => ({
                key: String(d.day),
                label:
                  r.days.length > 10
                    ? formatShortDate(d.day)
                    : formatWeekday(d.day),
                title: `${formatDate(d.day)} · ${d.count} فاتورة`,
                current:
                  metric === "net"
                    ? d.net
                    : metric === "profit"
                      ? d.profit
                      : d.count,
              }))}
              currentLabel={METRICS.find((m) => m.id === metric)!.label}
              kind={metric === "count" ? "count" : "money"}
              height={260}
            />
          )}
        </ChartCard>
        <ChartCard
          title="طريقة الدفع"
          subtitle="الكاش سيولة الآن، والآجل يحتاج تحصيلاً"
        >
          <Donut
            slices={[
              { key: "cash", label: "كاش", value: r.cash, color: CHART.main },
              {
                key: "credit",
                label: "آجل",
                value: r.credit,
                color: CHART.muted,
              },
            ]}
            centerLabel="المبيعات"
            centerValue={formatNumber(r.cash + r.credit)}
          />
        </ChartCard>
      </div>

      <Panel title="تفاصيل الأيام">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160">
            <thead className="border-b">
              <tr>
                {[
                  "اليوم",
                  "الفواتير",
                  "المبيعات",
                  "المرتجع",
                  "الصافي",
                  "التكلفة",
                  "الربح",
                ].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...r.days]
                .reverse()
                .filter((d) => d.count || d.returns)
                .map((d) => (
                  <tr key={d.day} className="border-b last:border-0">
                    <td className={td}>{formatDayLabel(d.day)}</td>
                    <td className={cn(td, "font-mono")}>{d.count}</td>
                    <td className={td}>
                      <Money amount={d.revenue} className="text-xs" />
                    </td>
                    <td className={td}>
                      {d.returns ? (
                        <Money
                          amount={d.returns}
                          className="text-xs text-destructive"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={td}>
                      <Money amount={d.net} className="text-xs" />
                    </td>
                    <td className={td}>
                      <Money amount={d.cost} className="text-xs" />
                    </td>
                    <td className={td}>
                      <Money
                        amount={d.profit}
                        className={cn(
                          "text-xs",
                          d.profit < 0 ? "text-destructive" : "text-success",
                        )}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="border-t-2 font-semibold">
              <tr>
                <td className={td}>الإجمالي</td>
                <td className={cn(td, "font-mono")}>{r.count}</td>
                <td className={td}>
                  <Money amount={r.revenue} className="text-xs" />
                </td>
                <td className={td}>
                  <Money amount={r.returns} className="text-xs" />
                </td>
                <td className={td}>
                  <Money amount={r.net} className="text-xs" />
                </td>
                <td className={td}>
                  <Money amount={r.cost} className="text-xs" />
                </td>
                <td className={td}>
                  <Money amount={r.profit} className="text-xs" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          كاش <Money amount={r.cash} className="text-[11px]" /> · آجل{" "}
          <Money amount={r.credit} className="text-[11px]" />. الربح = صافي
          المبيعات − تكلفة البضاعة المباعة (بمتوسط سعر الشراء وقت البيع).
        </p>
      </Panel>
    </div>
  );
}

/* ================= الأصناف ================= */
function ProductsTab({ period }: { period: PeriodValue }) {
  const [rank, setRank] = useState<ProductRank>("top");
  const q = useQuery({
    queryKey: ["reports", "products", period.range, rank],
    queryFn: () => fetchProductsReport(period.range, rank, 30),
  });
  const metric = (r: { qty: number; profit: number; revenue: number }) =>
    rank === "profit" ? r.profit : rank === "revenue" ? r.revenue : r.qty;
  return (
    <div className="space-y-3">
      <SegmentedTabs
        label="ترتيب الأصناف"
        items={RANKS}
        value={rank}
        onChange={setRank}
      />
      {!q.data ? (
        <Loading error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <p className="border border-dashed py-12 text-center text-sm text-muted-foreground">
          لا توجد مبيعات في هذه الفترة
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title={RANKS.find((r) => r.id === rank)!.label}
            subtitle="أعلى 12 صنفاً؛ الجدول بجانبه فيه الكل"
          >
            <RankBarChart
              valueLabel={
                rank === "profit"
                  ? "الربح"
                  : rank === "revenue"
                    ? "الإيراد"
                    : "الكمية"
              }
              kind={rank === "top" || rank === "bottom" ? "qty" : "money"}
              items={q.data.slice(0, 12).map((r) => ({
                key: r.productId,
                label: r.name,
                value: metric(r),
                extra: [
                  { label: "الإيراد", value: r.revenue },
                  { label: "الربح", value: r.profit },
                  {
                    label: `الكمية (${r.unit})`,
                    value: r.qty,
                    kind: "qty" as const,
                  },
                ],
              }))}
            />
          </ChartCard>
          <Panel title="الأرقام">
            <div className="overflow-x-auto">
              <table className="w-full min-w-120">
                <thead className="border-b">
                  <tr>
                    {["الصنف", "الكمية", "الإيراد", "الربح", "الرصيد"].map(
                      (h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((r) => (
                    <tr key={r.productId} className="border-b last:border-0">
                      <td className={cn(td, "max-w-40 truncate")}>{r.name}</td>
                      <td className={cn(td, "font-mono")}>
                        {formatQty(r.qty)}
                      </td>
                      <td className={td}>
                        <Money amount={r.revenue} className="text-xs" />
                      </td>
                      <td className={td}>
                        <Money
                          amount={r.profit}
                          className={cn(
                            "text-xs",
                            r.profit < 0 && "text-destructive",
                          )}
                        />
                      </td>
                      <td className={cn(td, "font-mono text-muted-foreground")}>
                        {formatQty(r.stock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ================= النواقص والراكد ================= */
function StockTab() {
  const q = useStockReport(30);
  if (!q.data) return <Loading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const list = (
    rows: typeof r.low,
    empty: string,
    extra: (row: (typeof r.low)[number]) => ReactNode,
  ) =>
    rows.length === 0 ? (
      <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y">
        {rows.slice(0, 15).map((row) => (
          <li
            key={row.productId}
            className="flex items-center justify-between gap-3 py-2 text-xs"
          >
            <span className="min-w-0 truncate">{row.name}</span>
            {extra(row)}
          </li>
        ))}
      </ul>
    );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title={`قارب على النفاد (${r.low.length})`}>
          {list(r.low, "لا يوجد", (row) => (
            <span className="font-mono text-warning">
              {formatQty(row.stock)} / {formatQty(row.minStock)} {row.unit}
            </span>
          ))}
        </Panel>
        <Panel title={`نفد (${r.out.length})`}>
          {list(r.out, "لا يوجد", () => (
            <Badge
              variant="outline"
              className="border-destructive/50 font-normal text-destructive"
            >
              نفد
            </Badge>
          ))}
        </Panel>
        <Panel title={`راكد 30 يوماً (${r.stagnant.length})`}>
          {list(r.stagnant, "لا يوجد", (row) => (
            <Money amount={row.stockValue} className="text-xs" />
          ))}
          {r.stagnant.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              أموال مجمّدة في الراكد:{" "}
              <Money amount={r.stagnantValue} className="text-[11px]" />
            </p>
          )}
        </Panel>
      </div>
      {r.stagnant.length > 0 && (
        <ChartCard
          title="أين تتجمد الأموال؟"
          subtitle="أكبر الأصناف الراكدة بقيمتها بسعر الشراء — مرشحة لعرض أو خصم"
        >
          <RankBarChart
            valueLabel="القيمة المجمّدة"
            items={[...r.stagnant]
              .sort((a, b) => b.stockValue - a.stockValue)
              .slice(0, 10)
              .map((row) => ({
                key: row.productId,
                label: row.name,
                value: row.stockValue,
                extra: [
                  {
                    label: `الرصيد (${row.unit})`,
                    value: row.stock,
                    kind: "qty" as const,
                  },
                ],
              }))}
          />
        </ChartCard>
      )}
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/admin/inventory" />}
      >
        فتح صفحة المخزون للجرد والتعديل
      </Button>
    </div>
  );
}

/* ================= المديونيات ================= */
function DebtsTab() {
  const q = useQuery({
    queryKey: ["reports", "debts"],
    queryFn: fetchDebtsReport,
  });
  if (!q.data) return <Loading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <StatTile index={0} icon={<IconUsers />} label="ديون العملاء">
          <Money amount={r.customersTotal} className="text-lg" />
        </StatTile>
        <StatTile
          index={1}
          icon={<IconAlertTriangle />}
          label={`متأخرة (${r.overdueCount} عميل)`}
          tone="danger"
        >
          <Money amount={r.overdueTotal} className="text-lg" />
        </StatTile>
        <StatTile
          index={2}
          icon={<IconArrowUpRight />}
          label="مستحق للموردين"
          tone="warning"
        >
          <Money amount={r.suppliersTotal} className="text-lg" />
        </StatTile>
      </div>
      {r.customers.length > 0 && (
        <ChartCard
          title="أكبر المدينين"
          subtitle="الأحمر = متأخر في السداد (أكثر من 30 يوماً بلا دفعة)"
        >
          <RankBarChart
            valueLabel="المديونية"
            items={[...r.customers]
              .sort((a, b) => b.balance - a.balance)
              .slice(0, 10)
              .map((c) => ({
                key: c.id,
                label: c.isOverdue ? `${c.name} (متأخر)` : c.name,
                value: c.balance,
                color: c.isOverdue ? CHART.bad : undefined,
                extra: [{ label: "الحد الائتماني", value: c.creditLimit }],
              }))}
          />
        </ChartCard>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="العملاء المدينون (المتأخر أولاً)">
          <ul className="divide-y">
            {r.customers.length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">
                لا توجد ديون
              </li>
            )}
            {r.customers.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    {c.isOverdue && (
                      <Badge
                        variant="outline"
                        className="border-destructive/50 px-1 font-normal text-destructive"
                      >
                        متأخر
                      </Badge>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.lastPaymentAt
                      ? `آخر دفعة ${formatDayLabel(c.lastPaymentAt)}`
                      : "لم يدفع بعد"}
                    {c.phone && (
                      <bdi dir="ltr" className="ms-2 font-mono">
                        {c.phone}
                      </bdi>
                    )}
                  </span>
                </span>
                <Money amount={c.balance} className="text-xs" />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="مستحقات الموردين">
          <ul className="divide-y">
            {r.suppliers.length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">
                لا توجد مستحقات
              </li>
            )}
            {r.suppliers.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span className="truncate font-medium">{s.name}</span>
                <Money amount={s.balance} className="text-xs" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* ================= الخزنة ================= */
function TreasuryTab({ period }: { period: PeriodValue }) {
  const q = useQuery({
    queryKey: ["reports", "treasury", period.range],
    queryFn: () => fetchTreasuryReport(period.range),
  });
  if (!q.data) return <Loading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  return (
    <div className="space-y-4">
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
      {r.byKind.length > 0 && (
        <ChartCard
          title="من أين دخلت الأموال وأين خرجت؟"
          subtitle="الأخضر داخل الخزنة والأحمر خارجها"
        >
          <RankBarChart
            valueLabel="المبلغ"
            items={r.byKind.map((k) => ({
              key: `${k.kind}-${k.direction}`,
              label: `${KIND_LABEL[k.kind as CashKind] ?? k.kind} (${k.direction === "in" ? "داخل" : "خارج"})`,
              value: k.total,
              color: k.direction === "in" ? CHART.good : CHART.bad,
              extra: [
                {
                  label: "عدد الحركات",
                  value: k.count,
                  kind: "count" as const,
                },
              ],
            }))}
          />
        </ChartCard>
      )}
      <Panel title="ملخص الخزنة حسب النوع">
        <ul className="divide-y">
          {r.byKind.length === 0 && (
            <li className="py-6 text-center text-xs text-muted-foreground">
              لا توجد حركات
            </li>
          )}
          {r.byKind.map((k) => (
            <li
              key={`${k.kind}-${k.direction}`}
              className="flex items-center justify-between gap-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2">
                {k.direction === "in" ? (
                  <IconArrowDownLeft className="size-4 text-success" />
                ) : (
                  <IconArrowUpRight className="size-4 text-destructive" />
                )}
                {KIND_LABEL[k.kind as CashKind] ?? k.kind}
                <span className="text-muted-foreground">({k.count})</span>
              </span>
              <span
                className={
                  k.direction === "in" ? "text-success" : "text-destructive"
                }
              >
                {k.direction === "in" ? "+" : "−"}{" "}
                <Money amount={k.total} className="text-xs" />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/** التقارير: فترة واحدة تتحكم في كل التبويبات، وكل رقم له جدول تحته. */
export function ReportsScreen() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [period, setPeriod] = useState<PeriodValue>(periodOf("month"));
  const usesPeriod =
    tab === "sales" || tab === "products" || tab === "treasury";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="التقارير"
        description="المبيعات والأرباح، الأكثر والأقل مبيعاً، النواقص والراكد، المديونيات المتأخرة، وملخص الخزنة."
        actions={
          <Button
            variant="outline"
            size="lg"
            onClick={() => window.print()}
            className="h-10 gap-2 font-normal"
          >
            <IconPrinter className="size-4" />
            طباعة
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs
          label="التقرير"
          items={TABS}
          value={tab}
          onChange={setTab}
        />
        {usesPeriod && <PeriodPicker value={period} onChange={setPeriod} />}
      </div>
      {tab === "sales" && <SalesTab period={period} />}
      {tab === "products" && <ProductsTab period={period} />}
      {tab === "stock" && <StockTab />}
      {tab === "debts" && <DebtsTab />}
      {tab === "treasury" && <TreasuryTab period={period} />}
    </div>
  );
}
