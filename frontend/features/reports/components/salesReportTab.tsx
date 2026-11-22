"use client";

import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBulb,
  IconCash,
  IconCoin,
  IconDiscountOff,
  IconMinus,
  IconReceipt,
  IconShoppingCartOff,
  IconWallet,
} from "@tabler/icons-react";
import { useState } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { CHART } from "@/components/shared/charts/chartTheme";
import { Donut } from "@/components/shared/charts/MiscCharts";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import type { DateRange } from "@/lib/dates";
import { formatDayLabel } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { useFeature } from "@/lib/plan";
import { useTaxConfig } from "@/lib/tax";
import { EReceiptReportPanel } from "@/features/eta/components/eReceiptWidgets";
import { cn } from "@/lib/utils";
import { changePct } from "@/features/dashboard/lib/insights";

import { SALES_METRICS } from "../config/reportOptions";
import { useSalesReport } from "../hooks/useReports";
import {
  activeDaysDesc,
  marginPct,
  previousRange,
  salesTrendSeries,
} from "../lib/reportSeries";
import type { SalesMetric, SalesReport } from "../types/report";
import {
  ReportLoading,
  ReportPanel,
  ReportTableHead,
  reportTd as td,
  reportTr as tr,
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

/** تغيّر الرقم عن الفترة السابقة بنفس الطول: سهم + نسبة، واللون مساعد فقط. */
function Change({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous?: number;
  inverse?: boolean;
}) {
  if (previous === undefined) return null;
  const pct = changePct(current, previous);
  if (pct === null) return null;
  const good = pct === 0 ? null : inverse ? pct < 0 : pct > 0;
  const Arrow =
    pct === 0 ? IconMinus : pct > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span
      className={cn(
        "me-1 inline-flex items-center gap-0.5 font-medium",
        good === null ? "" : good ? "text-success" : "text-destructive",
      )}
    >
      <Arrow aria-hidden className="size-3" />
      {Math.abs(pct)}%
    </span>
  );
}

const VS = "عن الفترة السابقة";

function SalesStats({ r, prev }: { r: SalesReport; prev?: SalesReport }) {
  // بدون المصروفات في الخطة: لا نعرض أصفاراً بلا معنى (إلا لو فيه مصروفات من قبل).
  const hasExpenses = useFeature("expenses") || r.expenses > 0;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconReceipt />}
        label="صافي المبيعات"
        hint={
          prev ? (
            <>
              <Change current={r.net} previous={prev.net} />
              {VS}
            </>
          ) : (
            `${r.count} فاتورة · خصومات ${formatNumber(r.discounts)}`
          )
        }
      >
        <Money amount={r.net} className="text-lg" />
      </StatTile>
      <StatTile
        index={1}
        icon={<IconCoin />}
        label="مجمل الربح"
        tone="success"
        hint={
          <>
            <Change current={r.profit} previous={prev?.profit} />
            هامش {marginPct(r.profit, r.net)}%
          </>
        }
      >
        <Money amount={r.profit} className="text-lg" />
      </StatTile>
      {hasExpenses ? (
        <>
          <StatTile
            index={2}
            icon={<IconCash />}
            label="المصروفات"
            tone="warning"
            hint={
              prev && prev.expenses > 0 ? (
                <>
                  <Change
                    current={r.expenses}
                    previous={prev.expenses}
                    inverse
                  />
                  {VS}
                </>
              ) : undefined
            }
          >
            <Money amount={r.expenses} className="text-lg" />
          </StatTile>
          <StatTile
            index={3}
            icon={<IconWallet />}
            label="صافي الربح بعد المصروفات"
            tone={r.netProfit < 0 ? "danger" : "success"}
            hint={
              prev && prev.netProfit !== 0 ? (
                <>
                  <Change current={r.netProfit} previous={prev.netProfit} />
                  {VS}
                </>
              ) : undefined
            }
          >
            <Money
              amount={r.netProfit}
              className={cn("text-lg", r.netProfit < 0 && "text-destructive")}
            />
          </StatTile>
        </>
      ) : (
        <>
          <StatTile
            index={2}
            icon={<IconWallet />}
            label="الخصومات والعروض"
            tone="warning"
          >
            <Money amount={r.discounts} className="text-lg" />
          </StatTile>
          <StatTile
            index={3}
            icon={<IconCash />}
            label="المرتجعات"
            tone="danger"
          >
            <Money amount={r.returns} className="text-lg" />
          </StatTile>
        </>
      )}
    </div>
  );
}

/**
 * الخلاصة بكلام بسيط قبل الأرقام: كم بعت، وكم كسبت، وأفضل يوم، ومقارنة بالفترة السابقة.
 * يقرأ التاجر جملة واحدة فيفهم، والتفاصيل تحتها لمن يريد.
 */
function SalesSummary({ r, prev }: { r: SalesReport; prev?: SalesReport }) {
  if (r.count === 0 && r.returns === 0) {
    return (
      <EmptyState
        icon={IconShoppingCartOff}
        text="لا توجد مبيعات في هذه الفترة. جرّب فترة أطول من قائمة الفترة."
        className="bg-card"
      />
    );
  }
  const best =
    r.days.length > 1 ? [...r.days].sort((a, b) => b.net - a.net)[0] : null;
  const pct = prev ? changePct(r.net, prev.net) : null;
  return (
    <div className="flex items-start gap-3 border border-primary/20 bg-primary/5 p-3">
      <IconBulb aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="text-sm leading-7">
        بعت بـ <Money amount={r.net} className="text-sm font-bold" /> في{" "}
        <b>
          <Num>{r.count}</Num>
        </b>{" "}
        فاتورة، وكسبت{" "}
        <Money
          amount={r.profit}
          className={cn(
            "text-sm font-bold",
            r.profit < 0 ? "text-destructive" : "text-success",
          )}
        />{" "}
        ربح (هامش <Num>{marginPct(r.profit, r.net)}</Num>%).
        {r.expenses > 0 && (
          <>
            {" "}
            بعد المصروفات يتبقى{" "}
            <Money
              amount={r.netProfit}
              className={cn(
                "text-sm font-bold",
                r.netProfit < 0 && "text-destructive",
              )}
            />
            .
          </>
        )}
        {best && best.net > 0 && (
          <>
            {" "}
            أفضل يوم: <b>{formatDayLabel(best.day)}</b> بـ{" "}
            <Money amount={best.net} className="text-sm" />.
          </>
        )}
        {pct !== null && pct !== 0 && (
          <>
            {" "}
            المبيعات{" "}
            <b className={pct > 0 ? "text-success" : "text-destructive"}>
              {pct > 0 ? "ارتفعت" : "انخفضت"} <Num>{Math.abs(pct)}</Num>%
            </b>{" "}
            عن الفترة السابقة.
          </>
        )}
      </p>
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
        <ChartEmpty
          text="لا توجد مبيعات في هذه الفترة"
          height={260}
          icon={IconShoppingCartOff}
        />
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

const ELECTRONIC_COLORS = [
  CHART.seq[1],
  CHART.seq[3],
  CHART.seq[2],
  CHART.seq[4],
  CHART.seq[0],
];

function PaymentSplitCard({ r }: { r: SalesReport }) {
  const slices = [
    { key: "cash", label: "نقدي", value: r.cash, color: CHART.main },
    { key: "credit", label: "آجل", value: r.credit, color: CHART.muted },
    ...r.electronic
      .filter((e) => e.value > 0)
      .map((e, i) => ({
        ...e,
        color: ELECTRONIC_COLORS[i % ELECTRONIC_COLORS.length],
      })),
  ];
  return (
    <ChartCard
      title="طريقة الدفع"
      subtitle="النقدي سيولة حاضرة، والآجل يحتاج إلى تحصيل، والمحافظ في حساب المحل"
    >
      <Donut
        slices={slices}
        centerLabel="المبيعات"
        centerValue={formatNumber(slices.reduce((sum, s) => sum + s.value, 0))}
      />
    </ChartCard>
  );
}

/**
 * من أين جاءت الخصومات؟ العروض قرار مخطط مسبقاً، وخصم الكاشير قرار لحظي يحتاج متابعة،
 * ونقاط الولاء مكافأة مستحقة للعميل.
 */
function DiscountBreakdown({ r }: { r: SalesReport }) {
  const parts = [
    {
      key: "promo",
      label: "العروض التلقائية",
      note: "عروضك المخططة (شاشة العروض)",
      value: r.promoDiscount,
      color: CHART.main,
    },
    {
      key: "lines",
      label: "خصم الكاشير على الأصناف",
      note: "يدوي على سطر في الفاتورة",
      value: r.linesDiscount,
      color: CHART.seq[3],
    },
    {
      key: "invoice",
      label: "خصم على إجمالي الفاتورة",
      note: "يدوي من الكاشير",
      value: r.invoiceDiscount,
      color: CHART.seq[2],
    },
    {
      key: "loyalty",
      label: "استبدال نقاط الولاء",
      note: "مكافأة مستحقة للعميل",
      value: r.loyaltyDiscount,
      color: CHART.seq[1],
    },
  ];
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const manual = r.linesDiscount + r.invoiceDiscount;
  return (
    <ReportPanel title="تفصيل الخصومات">
      {total === 0 ? (
        <EmptyState
          icon={IconDiscountOff}
          text="لا توجد خصومات في هذه الفترة"
        />
      ) : (
        <div className="space-y-3">
          <div
            aria-hidden
            className="flex h-2.5 w-full overflow-hidden bg-muted"
          >
            {parts.map((p) =>
              p.value > 0 ? (
                <span
                  key={p.key}
                  style={{
                    width: `${(p.value / total) * 100}%`,
                    background: p.color,
                  }}
                />
              ) : null,
            )}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {parts.map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-xs">
                <span
                  aria-hidden
                  className="mt-1 size-2.5 shrink-0"
                  style={{ background: p.color }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{p.label}</span>
                  <Money amount={p.value} className="text-sm" />
                  <span className="ms-1 font-mono text-[11px] text-muted-foreground">
                    {total ? Math.round((p.value / total) * 100) : 0}%
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {p.note}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {manual > 0 && r.revenue > 0 && (
            <p className="text-[11px] text-muted-foreground">
              الخصم اليدوي من الكاشيرية ={" "}
              <b className="font-mono text-foreground">
                {Math.round((manual / (r.revenue + manual)) * 1000) / 10}%
              </b>{" "}
              من قيمة البيع. التفصيل لكل كاشير في تبويب «الكاشيرية والورديات».
            </p>
          )}
        </div>
      )}
    </ReportPanel>
  );
}

/** ضريبة القيمة المضافة في الفترة. تظهر لو المحل فعّل الضريبة أو حُصّلت ضريبة في الفترة. */
function TaxSummary({ r }: { r: SalesReport }) {
  const tax = useTaxConfig();
  if (!tax.enabled && r.taxTotal === 0 && r.taxReturns === 0) return null;
  const items = [
    { label: "ضريبة محصّلة في الفواتير", value: r.taxTotal },
    { label: "ضريبة مردودة بالمرتجعات", value: r.taxReturns },
    { label: "صافي الضريبة المستحقة", value: r.taxNet },
  ];
  return (
    <ReportPanel title="ضريبة القيمة المضافة">
      <dl className="grid gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{i.label}</dt>
            <dd>
              <Money amount={i.value} className="text-base font-semibold" />
            </dd>
          </div>
        ))}
      </dl>
      {r.untaxedCount > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <Num>{r.untaxedCount}</Num> فاتورة في الفترة قبل تفعيل حساب الضريبة،
          ولا تدخل في هذه الأرقام.
        </p>
      )}
    </ReportPanel>
  );
}

function SalesDaysTable({ r }: { r: SalesReport }) {
  return (
    <ReportPanel title="تفاصيل الأيام" count={activeDaysDesc(r.days).length}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-160">
          <ReportTableHead columns={DAY_COLUMNS} />
          <tbody>
            {activeDaysDesc(r.days).map((d) => (
              <tr key={d.day} className={tr}>
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
        نقدي <Money amount={r.cash} className="text-[11px]" /> · آجل{" "}
        <Money amount={r.credit} className="text-[11px]" />
        {r.electronic
          .filter((e) => e.value > 0)
          .map((e) => (
            <span key={e.key}>
              {" "}
              · {e.label} <Money amount={e.value} className="text-[11px]" />
            </span>
          ))}
        . الربح = صافي المبيعات − تكلفة البضاعة المباعة (بمتوسط سعر الشراء وقت
        البيع).
      </p>
    </ReportPanel>
  );
}

export function SalesReportTab({ range }: { range: DateRange }) {
  const q = useSalesReport(range);
  // المقارنة تحتاج تقارير كاملة (بَسطة محدودة بآخر 7 أيام فقط).
  const canCompare = useFeature("full_reports");
  const prevQ = useSalesReport(previousRange(range), canCompare);
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const prev = prevQ.data;

  return (
    <div className="space-y-4">
      <SalesSummary r={r} prev={prev} />
      <SalesStats r={r} prev={prev} />
      <div className="grid gap-4 lg:grid-cols-3">
        <SalesTrendCard r={r} />
        <PaymentSplitCard r={r} />
      </div>
      <DiscountBreakdown r={r} />
      <TaxSummary r={r} />
      <EReceiptReportPanel range={range} />
      <SalesDaysTable r={r} />
    </div>
  );
}
