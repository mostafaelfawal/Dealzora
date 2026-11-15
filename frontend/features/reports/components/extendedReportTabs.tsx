"use client";

import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCash,
  IconClockHour4,
  IconDiscount,
  IconGift,
  IconPercentage,
  IconReceipt,
  IconReceiptRefund,
  IconTruckDelivery,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { RETURN_REASON_LABEL } from "@/features/sales/config/saleOptions";
import type { ReturnReason } from "@/features/sales/types/sale";
import { formatDateTime, formatDayLabel, parseIsoDay } from "@/lib/dates";
import type { DateRange } from "@/lib/dates";
import { formatNumber, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PROMO_STATUS_LABEL } from "../config/reportOptions";
import {
  useCashiersReport,
  useCustomersReport,
  usePromotionsReport,
  usePurchasesReport,
  useReturnsReport,
} from "../hooks/useReports";
import type {
  CashierRow,
  CustomersReport,
  PromoRow,
  PurchasedProduct,
  PurchasesReport,
} from "../types/report";
import {
  ReportLoading,
  ReportPanel,
  ReportTable,
  type ReportColumn,
} from "./reportPanel";

/* ---------- أدوات مشتركة ---------- */

/** نص مقطوع بعرض أقصى، مع tooltip يظهر النص كاملاً لو اتقطع. */
const clip = (text: string, className: string) => (
  <AppTooltip message={text} onlyWhenTruncated>
    <span className={cn("block truncate", className)}>{text}</span>
  </AppTooltip>
);

const money = (amount: number, className?: string) => (
  <Money amount={amount} className={cn("text-xs", className)} />
);
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

function Stats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{children}</div>;
}

/** يعرض البيانات بعد التحميل، أو هيكل التحميل/الخطأ. */
function Loaded<T>({
  q,
  children,
}: {
  q: { data?: T; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  return <div className="space-y-4">{children(q.data)}</div>;
}

/* ================= المشتريات ================= */

function PriceChange({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      dir="ltr"
      className={cn(
        "font-mono",
        value > 0 ? "text-destructive" : "text-success",
      )}
    >
      {value > 0 ? "+" : "−"}
      {Math.abs(value)}%
    </span>
  );
}

const PURCHASED_COLUMNS: ReportColumn<PurchasedProduct>[] = [
  { header: "الصنف", cell: (r) => clip(r.name, "max-w-44") },
  {
    header: "الكمية",
    cell: (r) => `${formatQty(r.qty)} ${r.unit}`,
    className: "font-mono",
  },
  { header: "التكلفة", cell: (r) => money(r.total) },
  { header: "آخر سعر للوحدة", cell: (r) => money(r.lastCost) },
  { header: "التغيّر في الفترة", cell: (r) => <PriceChange value={r.changePct} /> },
];

const PRICE_COLUMNS: ReportColumn<PurchasedProduct>[] = [
  { header: "الصنف", cell: (r) => clip(r.name, "max-w-44") },
  { header: "أول سعر", cell: (r) => money(r.firstCost) },
  { header: "آخر سعر", cell: (r) => money(r.lastCost) },
  { header: "التغيّر", cell: (r) => <PriceChange value={r.changePct} /> },
];

function OrdersPanel({ r }: { r: PurchasesReport }) {
  return (
    <ReportPanel
      title="طلبات الشراء"
      action={
        <Link
          href="/admin/purchase-orders"
          className="text-xs text-primary hover:underline"
        >
          فتح الطلبات
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[
          ["مسودة", r.draftOrders],
          ["مُرسلة لم تصل", r.sentOrders],
          ["استُلمت في الفترة", r.receivedOrders],
        ].map(([label, value]) => (
          <div key={label as string} className="border p-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-base font-semibold">{value}</dd>
          </div>
        ))}
        <div className="border p-2">
          <dt className="text-muted-foreground">قيمة المفتوح</dt>
          <dd>{money(r.openOrdersTotal, "text-base font-semibold")}</dd>
        </div>
      </dl>
      {r.lateOrders.length > 0 && (
        <ul className="divide-y border-t text-xs">
          {r.lateOrders.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="flex items-center gap-2">
                <IconAlertTriangle className="size-4 text-warning" />
                طلب #{o.number} · {o.supplierName}
                <span className="text-muted-foreground">
                  أُرسل منذ {o.days} يوم
                </span>
              </span>
              {money(o.total)}
            </li>
          ))}
        </ul>
      )}
    </ReportPanel>
  );
}

export function PurchasesReportTab({ range }: { range: DateRange }) {
  return (
    <Loaded q={usePurchasesReport(range)}>
      {(r) => (
        <>
          <Stats>
            <StatTile
              index={0}
              icon={<IconTruckDelivery />}
              label="صافي المشتريات"
              hint={`${r.count} فاتورة شراء`}
            >
              <Money amount={r.net} className="text-lg" />
            </StatTile>
            <StatTile
              index={1}
              icon={<IconCash />}
              label="المدفوع للموردين"
              tone="success"
            >
              <Money amount={r.paid} className="text-lg" />
            </StatTile>
            <StatTile
              index={2}
              icon={<IconClockHour4 />}
              label="على الحساب (آجل)"
              tone="warning"
            >
              <Money amount={r.credit} className="text-lg" />
            </StatTile>
            <StatTile
              index={3}
              icon={<IconArrowBackUp />}
              label="مرتجع للموردين"
              hint={r.discount ? `خصومات الموردين ${formatNumber(r.discount)}` : undefined}
            >
              <Money amount={r.returned} className="text-lg" />
            </StatTile>
          </Stats>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="المشتريات حسب المورد"
              subtitle="من أين تأتي بضاعتك، وكم تعتمد على كل مورد"
            >
              {r.bySupplier.length === 0 ? (
                <ChartEmpty text="لا توجد مشتريات في هذه الفترة" />
              ) : (
                <RankBarChart
                  valueLabel="المشتريات"
                  items={r.bySupplier.map((s) => ({
                    key: s.id,
                    label: s.name,
                    value: s.total,
                    extra: [
                      { label: "الفواتير", value: s.count, kind: "count" as const },
                    ],
                  }))}
                />
              )}
            </ChartCard>
            <OrdersPanel r={r} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportTable
              title="أكثر الأصناف شراءً (بالتكلفة)"
              rows={r.topProducts}
              columns={PURCHASED_COLUMNS}
              getKey={(x) => x.productId}
              empty="لا توجد مشتريات"
            />
            <ReportTable
              title="تغيّر أسعار الشراء في الفترة (الأكبر أولاً)"
              rows={r.priceChanges}
              columns={PRICE_COLUMNS}
              getKey={(x) => x.productId}
              empty="لم تتغير أسعار الشراء في هذه الفترة"
              minWidth="min-w-100"
            />
          </div>
        </>
      )}
    </Loaded>
  );
}

/* ================= العروض ================= */

const STATUS_CLASS: Record<string, string> = {
  active: "border-success/50 text-success",
  scheduled: "border-primary/50 text-primary",
  expired: "text-muted-foreground",
  paused: "border-warning/50 text-warning",
};

function PromoPeriod({ p }: { p: PromoRow }) {
  if (!p.startsOn && !p.endsOn)
    return <span className="text-muted-foreground">مفتوح</span>;
  const d = (iso: string | null) =>
    iso ? formatDayLabel(parseIsoDay(iso)) : "…";
  return (
    <span className="text-muted-foreground">
      {d(p.startsOn)} ← {d(p.endsOn)}
    </span>
  );
}

const PROMO_COLUMNS: ReportColumn<PromoRow>[] = [
  { header: "العرض", cell: (p) => clip(p.name, "max-w-52"), className: "font-medium" },
  {
    header: "الحالة",
    cell: (p) =>
      p.status ? (
        <Badge
          variant="outline"
          className={cn("font-normal", STATUS_CLASS[p.status])}
        >
          {PROMO_STATUS_LABEL[p.status]}
        </Badge>
      ) : (
        <span className="text-muted-foreground">محذوف</span>
      ),
  },
  { header: "المدة", cell: (p) => <PromoPeriod p={p} /> },
  { header: "الخصم في الفترة", cell: (p) => money(p.discount) },
  { header: "الفواتير", cell: (p) => formatNumber(p.invoices), className: "font-mono" },
  { header: "الكمية المباعة", cell: (p) => formatQty(p.qty), className: "font-mono" },
  { header: "مبيعات أصنافه", cell: (p) => money(p.revenue) },
];

export function PromotionsReportTab({ range }: { range: DateRange }) {
  return (
    <Loaded q={usePromotionsReport(range)}>
      {(r) => {
        const used = r.promos.filter((p) => p.discount > 0);
        const active = r.promos.filter((p) => p.status === "active").length;
        return (
          <>
            <Stats>
              <StatTile
                index={0}
                icon={<IconDiscount />}
                label="خصم العروض"
                hint={`${used.length} عرض طُبق في الفترة`}
              >
                <Money amount={r.discount} className="text-lg" />
              </StatTile>
              <StatTile
                index={1}
                icon={<IconReceipt />}
                label="فواتير فيها عرض"
                hint={`${pct(r.invoices, r.salesCount)}% من ${formatNumber(r.salesCount)} فاتورة`}
              >
                <span className="font-mono">{formatNumber(r.invoices)}</span>
              </StatTile>
              <StatTile
                index={2}
                icon={<IconPercentage />}
                label="خصم الكاشير اليدوي"
                tone="warning"
                hint="للمقارنة: خصم غير مخطط"
              >
                <Money amount={r.manualDiscount} className="text-lg" />
              </StatTile>
              <StatTile
                index={3}
                icon={<IconGift />}
                label="عروض سارية الآن"
                tone="success"
              >
                <span className="font-mono">{active}</span>
              </StatTile>
            </Stats>

            <ChartCard
              title="أي عرض يكلّف أكثر؟"
              subtitle="الخصم الذي منحه كل عرض في الفترة، ومبيعات أصنافه أثناءه"
              href="/admin/promotions"
            >
              {used.length === 0 ? (
                <ChartEmpty text="لم يُطبق أي عرض في هذه الفترة" />
              ) : (
                <RankBarChart
                  valueLabel="الخصم"
                  labelWidth={180}
                  items={used.map((p) => ({
                    key: p.id ?? p.name,
                    label: p.name,
                    value: p.discount,
                    extra: [
                      { label: "مبيعات أصنافه", value: p.revenue },
                      { label: "الفواتير", value: p.invoices, kind: "count" as const },
                    ],
                  }))}
                />
              )}
            </ChartCard>

            <ReportTable
              title="كل العروض"
              rows={r.promos}
              columns={PROMO_COLUMNS}
              getKey={(p) => p.id ?? `deleted:${p.name}`}
              empty="لا توجد عروض. أنشئ عرضاً من شاشة العروض."
              minWidth="min-w-180"
            />
          </>
        );
      }}
    </Loaded>
  );
}

/* ================= المرتجعات ================= */

export function ReturnsReportTab({ range }: { range: DateRange }) {
  return (
    <Loaded q={useReturnsReport(range)}>
      {(r) => (
        <>
          <Stats>
            <StatTile
              index={0}
              icon={<IconReceiptRefund />}
              label="قيمة المرتجع"
              tone="danger"
              hint={`${r.count} عملية مرتجع`}
            >
              <Money amount={r.total} className="text-lg" />
            </StatTile>
            <StatTile
              index={1}
              icon={<IconPercentage />}
              label="نسبة المرتجع من المبيعات"
              tone={pct(r.total, r.revenue) > 5 ? "danger" : "default"}
            >
              <span className="font-mono">{pct(r.total, r.revenue)}%</span>
            </StatTile>
            <StatTile index={2} icon={<IconCash />} label="رُد نقداً من الدرج">
              <Money amount={r.cashRefund} className="text-lg" />
            </StatTile>
            <StatTile
              index={3}
              icon={<IconUsers />}
              label="خُصم من ديون / للمحافظ"
              hint={`ديون ${formatNumber(r.creditRefund)} · محافظ ${formatNumber(r.walletRefund)}`}
            >
              <Money
                amount={r.creditRefund + r.walletRefund}
                className="text-lg"
              />
            </StatTile>
          </Stats>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="أسباب المرتجع"
              subtitle="«تالف» كثير = راجع المورد والتخزين؛ «صنف خاطئ» = راجع الكاشير"
              href="/admin/returns"
            >
              {r.byReason.length === 0 ? (
                <ChartEmpty text="لا توجد مرتجعات في هذه الفترة" />
              ) : (
                <RankBarChart
                  valueLabel="القيمة"
                  items={r.byReason.map((x) => ({
                    key: x.key,
                    label: RETURN_REASON_LABEL[x.key as ReturnReason] ?? x.key,
                    value: x.value,
                    extra: [{ label: "العدد", value: x.count, kind: "count" as const }],
                  }))}
                />
              )}
            </ChartCard>
            <ReportTable
              title="المرتجع حسب الكاشير"
              rows={r.byCashier}
              columns={[
                { header: "الكاشير", cell: (c) => c.name, className: "font-medium" },
                { header: "العمليات", cell: (c) => c.count, className: "font-mono" },
                { header: "القيمة", cell: (c) => money(c.total) },
              ]}
              getKey={(c) => c.userId}
              empty="لا توجد مرتجعات"
              minWidth="min-w-80"
            />
          </div>

          <ReportTable
            title="الأصناف الأكثر رجوعاً"
            rows={r.topProducts}
            columns={[
              { header: "الصنف", cell: (x) => clip(x.name, "max-w-52"), className: "font-medium" },
              { header: "الكمية", cell: (x) => `${formatQty(x.qty)} ${x.unit}`, className: "font-mono" },
              { header: "مرات الرجوع", cell: (x) => x.times, className: "font-mono" },
              { header: "القيمة", cell: (x) => money(x.amount) },
            ]}
            getKey={(x) => x.productId}
            empty="لا توجد مرتجعات في هذه الفترة"
          />
        </>
      )}
    </Loaded>
  );
}

/* ================= العملاء ونقاط الولاء ================= */

function LoyaltyPanel({ l }: { l: CustomersReport["loyalty"] }) {
  if (!l.enabled && l.outstandingPoints === 0) {
    return (
      <ReportPanel title="نقاط الولاء">
        <p className="py-6 text-center text-xs text-muted-foreground">
          نقاط الولاء غير مفعّلة.{" "}
          <Link
            href="/admin/settings#loyalty"
            className="font-medium text-primary hover:underline"
          >
            تفعيل من الإعدادات
          </Link>
        </p>
      </ReportPanel>
    );
  }
  const rows: [string, ReactNode][] = [
    ["نقاط اكتسبها العملاء", formatNumber(l.earned)],
    ["نقاط استبدلوها", formatNumber(l.redeemed)],
    ["قيمة خصم الاستبدال", money(l.redeemValue)],
    ["تعديلات يدوية (هدايا/خصم)", formatNumber(l.adjusted)],
    [`أرصدة العملاء الآن (${l.members} عميل)`, formatNumber(l.outstandingPoints)],
    ["قيمتها لو استُبدلت (التزام على المحل)", money(l.outstandingValue, "text-warning")],
  ];
  return (
    <ReportPanel title={l.enabled ? "نقاط الولاء" : "نقاط الولاء (متوقفة حالياً)"}>
      <dl className="divide-y text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt>{label}</dt>
            <dd className="font-mono font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {l.topBalances.length > 0 && (
        <>
          <p className="pt-2 text-xs font-medium">أعلى الأرصدة</p>
          <ul className="divide-y text-xs">
            {l.topBalances.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-1.5">
                <AppTooltip message={b.name} onlyWhenTruncated>
                  <span className="truncate">{b.name}</span>
                </AppTooltip>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{formatNumber(b.points)} نقطة</span>
                  {money(b.value, "text-muted-foreground")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ReportPanel>
  );
}

export function CustomersReportTab({ range }: { range: DateRange }) {
  return (
    <Loaded q={useCustomersReport(range)}>
      {(r) => {
        const total = r.walkInSales + r.customerSales;
        return (
          <>
            <Stats>
              <StatTile
                index={0}
                icon={<IconUsers />}
                label="عملاء اشتروا في الفترة"
                hint={`من ${r.totalCustomers} عميل مسجّل`}
              >
                <span className="font-mono">{r.active}</span>
              </StatTile>
              <StatTile
                index={1}
                icon={<IconUserPlus />}
                label="عملاء جدد"
                tone="success"
              >
                <span className="font-mono">{r.new}</span>
              </StatTile>
              <StatTile
                index={2}
                icon={<IconReceipt />}
                label="مبيعات لعملاء مسجلين"
                hint={`${pct(r.customerSales, total)}% من صافي المبيعات`}
              >
                <Money amount={r.customerSales} className="text-lg" />
              </StatTile>
              <StatTile
                index={3}
                icon={<IconAlertTriangle />}
                label="عملاء انقطعوا (+30 يوماً)"
                tone={r.lapsed.length ? "warning" : "default"}
              >
                <span className="font-mono">{r.lapsed.length}</span>
              </StatTile>
            </Stats>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ReportTable
                  title="أفضل العملاء في الفترة"
                  rows={r.top}
                  columns={[
                    { header: "العميل", cell: (c) => clip(c.name, "max-w-44"), className: "font-medium" },
                    { header: "صافي المشتريات", cell: (c) => money(c.net) },
                    { header: "الفواتير", cell: (c) => c.invoices, className: "font-mono" },
                    { header: "متوسط الفاتورة", cell: (c) => money(c.avgTicket) },
                    { header: "النقاط", cell: (c) => formatNumber(c.points), className: "font-mono" },
                    {
                      header: "آخر شراء",
                      cell: (c) => (c.lastAt ? formatDayLabel(c.lastAt) : "—"),
                      className: "text-muted-foreground",
                    },
                  ]}
                  getKey={(c) => c.id}
                  empty="لا توجد مبيعات لعملاء مسجلين في هذه الفترة"
                  minWidth="min-w-150"
                />
              </div>
              <LoyaltyPanel l={r.loyalty} />
            </div>

            <ReportTable
              title="عملاء انقطعوا عن الشراء (كلّمهم أو ابعتلهم عرضاً)"
              rows={r.lapsed}
              columns={[
                { header: "العميل", cell: (c) => c.name, className: "font-medium" },
                {
                  header: "التليفون",
                  cell: (c) =>
                    c.phone ? (
                      <bdi dir="ltr" className="font-mono">
                        {c.phone}
                      </bdi>
                    ) : (
                      "—"
                    ),
                },
                { header: "آخر شراء", cell: (c) => `منذ ${c.days} يوم`, className: "text-warning" },
                { header: "كل مشترياته", cell: (c) => money(c.lifetime) },
              ]}
              getKey={(c) => c.id}
              empty="لا يوجد عميل منقطع — كل عملائك اشتروا خلال آخر 30 يوماً"
            />
          </>
        );
      }}
    </Loaded>
  );
}

/* ================= الكاشيرية والورديات ================= */

const CASHIER_COLUMNS: ReportColumn<CashierRow>[] = [
  { header: "الكاشير", cell: (c) => c.name, className: "font-medium" },
  { header: "الفواتير", cell: (c) => c.invoices, className: "font-mono" },
  { header: "الصافي", cell: (c) => money(c.net) },
  { header: "متوسط الفاتورة", cell: (c) => money(c.avgTicket) },
  {
    header: "خصم يدوي",
    cell: (c) => (
      <span className="inline-flex items-baseline gap-1">
        {money(c.manualDiscount, c.manualDiscount > 0 ? "text-warning" : undefined)}
        <span className="font-mono text-[10px] text-muted-foreground">
          {pct(c.manualDiscount, c.sales + c.manualDiscount)}%
        </span>
      </span>
    ),
  },
  {
    header: "مرتجع",
    cell: (c) =>
      c.returnsCount ? (
        <span className="inline-flex items-baseline gap-1">
          {money(c.returns, "text-destructive")}
          <span className="text-[10px] text-muted-foreground">({c.returnsCount})</span>
        </span>
      ) : (
        "—"
      ),
  },
  { header: "ورديات", cell: (c) => c.shifts, className: "font-mono" },
  {
    header: "عجز / زيادة",
    cell: (c) =>
      c.shortage || c.overage ? (
        <span className="inline-flex flex-wrap items-baseline gap-1">
          {c.shortage > 0 && money(-c.shortage, "text-destructive")}
          {c.overage > 0 && money(c.overage, "text-success")}
        </span>
      ) : (
        <span className="text-success">مطابق</span>
      ),
  },
];

export function CashiersReportTab({ range }: { range: DateRange }) {
  return (
    <Loaded q={useCashiersReport(range)}>
      {(r) => (
        <>
          <Stats>
            <StatTile
              index={0}
              icon={<IconClockHour4 />}
              label="الورديات"
              hint={r.openShifts ? `${r.openShifts} مفتوحة الآن` : "كلها مقفولة"}
            >
              <span className="font-mono">{r.shiftsCount}</span>
            </StatTile>
            <StatTile
              index={1}
              icon={<IconAlertTriangle />}
              label="إجمالي العجز"
              tone={r.shortage ? "danger" : "default"}
            >
              <Money amount={r.shortage} className="text-lg" />
            </StatTile>
            <StatTile
              index={2}
              icon={<IconCash />}
              label="إجمالي الزيادة"
              tone={r.overage ? "warning" : "default"}
            >
              <Money amount={r.overage} className="text-lg" />
            </StatTile>
            <StatTile
              index={3}
              icon={<IconUsers />}
              label="كاشيرية عملوا"
            >
              <span className="font-mono">{r.cashiers.length}</span>
            </StatTile>
          </Stats>

          <ReportTable
            title="أداء كل كاشير"
            rows={r.cashiers}
            columns={CASHIER_COLUMNS}
            getKey={(c) => c.userId || "unknown"}
            empty="لا توجد مبيعات في هذه الفترة"
            minWidth="min-w-190"
          />

          <ReportTable
            title="ورديات بها عجز أو زيادة (الأكبر أولاً)"
            rows={r.differences}
            columns={[
              { header: "الكاشير", cell: (d) => d.cashierName, className: "font-medium" },
              { header: "فُتحت", cell: (d) => formatDateTime(d.openedAt), className: "text-muted-foreground" },
              { header: "المتوقع في الدرج", cell: (d) => money(d.expected) },
              { header: "المعدود", cell: (d) => money(d.counted) },
              {
                header: "الفرق",
                cell: (d) =>
                  money(d.difference, d.difference < 0 ? "text-destructive" : "text-success"),
              },
            ]}
            getKey={(d) => d.id}
            empty="كل الورديات مطابقة في هذه الفترة"
            minWidth="min-w-150"
          />
          <p className="text-[11px] text-muted-foreground">
            الخصم اليدوي = خصم الكاشير على الأصناف وعلى إجمالي الفاتورة (بدون العروض التلقائية).
            حد الخصم المسموح للكاشير من الإعدادات ← البيع ← حد الخصم.
          </p>
        </>
      )}
    </Loaded>
  );
}
