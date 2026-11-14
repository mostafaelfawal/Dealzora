"use client";

import { IconLock, IconSparkles } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { RETURN_REASON_LABEL } from "@/features/sales/config/saleOptions";
import type { ReturnReason } from "@/features/sales/types/sale";
import { formatNumber } from "@/lib/format";
import { FEATURE_INFO, usePlan, type PlanFeature } from "@/lib/plan";
import { cn } from "@/lib/utils";

import { changePct } from "../lib/insights";
import type {
  CustomersBrief,
  ExpiryBrief,
  LoyaltyBrief,
  NamedValue,
  PromotionsBrief,
  PurchasingBrief,
} from "../types/dashboard";

/**
 * أقسام اللوحة للميزات الإضافية (العروض، الولاء، العملاء، المشتريات، الصلاحية).
 * كل قسم يظهر فقط لو الـ backend أرسله (أي أن الميزة في خطة المحل).
 */

type Tone = "bad" | "warn" | "good";

const TONE_TEXT: Record<Tone, string> = {
  bad: "text-destructive",
  warn: "text-warning",
  good: "text-success",
};
const TONE_DOT: Record<Tone, string> = {
  bad: "bg-destructive",
  warn: "bg-warning",
  good: "bg-success",
};

interface StatRow {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  href?: string;
}

/** صفوف «اسم ← قيمة» بنفس شكل بطاقة صحة النشاط، والصف القابل للنقر يقود لشاشته. */
function StatRows({ rows }: { rows: StatRow[] }) {
  return (
    <ul className="divide-y text-xs">
      {rows.map((row, i) => {
        const content = (
          <>
            <span className="flex items-center gap-2">
              {row.tone && (
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", TONE_DOT[row.tone])}
                />
              )}
              {row.label}
            </span>
            <span
              className={cn(
                "font-mono font-semibold",
                row.tone && TONE_TEXT[row.tone],
              )}
            >
              {row.value}
            </span>
          </>
        );
        const cls = "flex items-center justify-between gap-3 py-2";
        return (
          <li key={i}>
            {row.href ? (
              <Link href={row.href} className={cn(cls, "hover:bg-muted/40")}>
                {content}
              </Link>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const money = (amount: number, className?: string) => (
  <Money amount={amount} className={cn("text-xs", className)} />
);

/** «+12%» / «−8%» مقارنة بالفترة السابقة. inverse: الزيادة سيئة (مثل الخصومات). */
function Change({
  current,
  previous,
  inverse,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  const pct = changePct(current, previous);
  if (pct === null || pct === 0) return null;
  const up = pct > 0;
  const good = inverse ? !up : up;
  return (
    <span
      dir="ltr"
      className={cn(
        "ms-1 text-[10px] font-normal",
        good ? "text-success" : "text-destructive",
      )}
    >
      {up ? "+" : "−"}
      {Math.abs(pct)}%
    </span>
  );
}

/** مؤشر صغير في رأس البطاقة: رقم كبير وتحته وصف. */
function Figure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 border bg-muted/30 p-2.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-base font-semibold">{children}</div>
    </div>
  );
}

const rankItems = (
  rows: NamedValue[],
  extra: { label: string; kind?: "money" | "count" },
  labelOf: (r: NamedValue) => string = (r) => r.label,
) =>
  rows.map((r) => ({
    key: r.key,
    label: labelOf(r),
    value: r.value,
    extra: [{ ...extra, value: r.extra }],
  }));

/* ---------- العروض ---------- */

export function PromotionsCard({
  promotions: p,
  invoices,
}: {
  promotions: PromotionsBrief;
  invoices: number;
}) {
  const share = invoices > 0 ? Math.round((p.invoices / invoices) * 100) : 0;
  return (
    <ChartCard
      index={11}
      title="العروض والخصومات التلقائية"
      subtitle="ما وفّرته العروض للعملاء في الفترة، وأي عرض يعمل أكثر"
      href="/admin/promotions"
      className="lg:col-span-2"
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="عروض سارية الآن">
          <span className="font-mono">{p.active}</span>
          {p.scheduled > 0 && (
            <span className="ms-1 text-[11px] font-normal text-muted-foreground">
              + {p.scheduled} مجدول
            </span>
          )}
        </Figure>
        <Figure label="خصم العروض في الفترة">
          <Money amount={p.discount} className="text-base" />
          <Change current={p.discount} previous={p.prevDiscount} />
        </Figure>
        <Figure label="فواتير طُبق فيها عرض">
          <span className="font-mono">{formatNumber(p.invoices)}</span>
        </Figure>
        <Figure label="من إجمالي الفواتير">
          <span className="font-mono">{share}%</span>
        </Figure>
      </div>
      {p.top.length === 0 ? (
        <ChartEmpty
          text={
            p.active > 0
              ? "لم يُطبق أي عرض في هذه الفترة"
              : "لا توجد عروض سارية — أنشئ عرضاً لتحريك الراكد"
          }
          height={120}
        />
      ) : (
        <RankBarChart
          valueLabel="الخصم"
          items={rankItems(p.top, { label: "مرات التطبيق", kind: "count" })}
          labelWidth={170}
        />
      )}
    </ChartCard>
  );
}

/* ---------- أسباب المرتجع ---------- */

export function ReturnReasonsCard({ reasons }: { reasons: NamedValue[] }) {
  return (
    <ChartCard
      index={12}
      title="لماذا يرجع العملاء البضاعة؟"
      subtitle="قيمة المرتجع حسب السبب"
      href="/admin/returns"
    >
      {reasons.length === 0 ? (
        <ChartEmpty text="لا توجد مرتجعات في هذه الفترة" height={120} />
      ) : (
        <RankBarChart
          valueLabel="القيمة"
          items={rankItems(
            reasons,
            { label: "العدد", kind: "count" },
            (r) => RETURN_REASON_LABEL[r.key as ReturnReason] ?? r.label,
          )}
        />
      )}
    </ChartCard>
  );
}

/* ---------- العملاء ---------- */

export function TopCustomersCard({ customers: c }: { customers: CustomersBrief }) {
  return (
    <ChartCard
      index={13}
      title="أفضل العملاء"
      subtitle="صافي المشتريات بعد المرتجع في الفترة"
      href="/admin/customers"
    >
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Figure label="عملاء اشتروا">
          <span className="font-mono">{c.activeCustomers}</span>
        </Figure>
        <Figure label="عملاء جدد">
          <span className="font-mono">{c.newCustomers}</span>
        </Figure>
      </div>
      {c.top.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات لعملاء مسجلين" height={120} />
      ) : (
        <RankBarChart
          valueLabel="المشتريات"
          items={rankItems(c.top, { label: "الفواتير", kind: "count" })}
        />
      )}
    </ChartCard>
  );
}

/* ---------- نقاط الولاء ---------- */

export function LoyaltyCard({ loyalty: l }: { loyalty: LoyaltyBrief }) {
  return (
    <ChartCard
      index={14}
      title="نقاط الولاء"
      subtitle="الكسب والاستبدال في الفترة، والأرصدة الآن"
      href="/admin/customers"
    >
      {!l.enabled && l.outstandingPoints === 0 ? (
        <div className="space-y-3 py-6 text-center text-xs text-muted-foreground">
          <p>نقاط الولاء غير مفعّلة. تشجّع العميل يرجع لك بدل المحل المجاور.</p>
          <Link
            href="/admin/settings#loyalty"
            className="font-medium text-primary hover:underline"
          >
            تفعيل من الإعدادات
          </Link>
        </div>
      ) : (
        <StatRows
          rows={[
            ...(!l.enabled
              ? [
                  {
                    label: "النقاط متوقفة حالياً",
                    value: "تفعيل",
                    tone: "warn" as const,
                    href: "/admin/settings#loyalty",
                  },
                ]
              : []),
            { label: "نقاط اكتسبها العملاء", value: formatNumber(l.earned) },
            { label: "نقاط استبدلوها", value: formatNumber(l.redeemed) },
            { label: "قيمة خصم الاستبدال", value: money(l.redeemValue) },
            {
              label: `أرصدة العملاء الآن (${l.members} عميل)`,
              value: formatNumber(l.outstandingPoints),
            },
            {
              label: "قيمتها لو استُبدلت",
              value: money(l.outstandingValue),
              tone: l.outstandingValue > 0 ? "warn" : undefined,
            },
          ]}
        />
      )}
    </ChartCard>
  );
}

/* ---------- المشتريات وطلبات الشراء ---------- */

export function PurchasingCard({
  purchasing: p,
}: {
  purchasing: PurchasingBrief;
}) {
  const open = p.draftOrders + p.sentOrders;
  return (
    <ChartCard
      index={15}
      title="المشتريات وطلبات الشراء"
      subtitle="ما اشتريته في الفترة، وما ينتظر الوصول من الموردين"
      href="/admin/purchase-orders"
    >
      <StatRows
        rows={[
          {
            label: `مشتريات الفترة (${p.purchasesCount} فاتورة)`,
            value: (
              <>
                {money(p.purchasesTotal)}
                <Change
                  current={p.purchasesTotal}
                  previous={p.prevPurchasesTotal}
                  inverse
                />
              </>
            ),
            href: "/admin/purchases",
          },
          {
            label: "طلبات مُرسلة لم تصل",
            value: p.sentOrders,
            tone: p.sentOrders ? "warn" : undefined,
            href: "/admin/purchase-orders",
          },
          {
            label: "طلبات مسودة",
            value: p.draftOrders,
            href: "/admin/purchase-orders",
          },
          {
            label: `قيمة الطلبات المفتوحة (${open})`,
            value: money(p.openOrdersTotal),
            href: "/admin/purchase-orders",
          },
          {
            label: "طلبات استُلمت هذا الشهر",
            value: p.receivedMonth,
            tone: p.receivedMonth ? "good" : undefined,
          },
        ]}
      />
    </ChartCard>
  );
}

/* ---------- الصلاحية ---------- */

export function ExpiryCard({ expiry: e }: { expiry: ExpiryBrief }) {
  return (
    <ChartCard
      index={16}
      title="الصلاحية"
      subtitle="الدفعات المنتهية والقريبة (لا تتأثر بالفترة)"
      href="/admin/expiry"
    >
      {e.trackedProducts === 0 ? (
        <div className="space-y-3 py-6 text-center text-xs text-muted-foreground">
          <p>لا توجد أصناف متتبَّعة الصلاحية بعد.</p>
          <p>فعّل «تتبع الصلاحية» على الألبان والمعلبات من شاشة الصنف.</p>
        </div>
      ) : (
        <StatRows
          rows={[
            {
              label: `دفعات منتهية (${e.expiredBatches})`,
              value: money(e.expiredValue),
              tone: e.expiredBatches ? "bad" : undefined,
              href: "/admin/expiry",
            },
            {
              label: "تنتهي خلال 7 أيام",
              value: e.soon7,
              tone: e.soon7 ? "bad" : undefined,
              href: "/admin/expiry",
            },
            {
              label: `تنتهي خلال 30 يوماً (${e.soon30})`,
              value: money(e.soon30Value),
              tone: e.soon30 ? "warn" : undefined,
              href: "/admin/expiry",
            },
            { label: "أصناف متتبَّعة", value: e.trackedProducts },
          ]}
        />
      )}
    </ChartCard>
  );
}

/* ---------- ميزات خارج الخطة ---------- */

/** ميزات تضيف أقساماً للوحة، بالترتيب الذي يهم التاجر. */
const DASHBOARD_FEATURES: { feature: PlanFeature; adds: string }[] = [
  { feature: "customers", adds: "العملاء والآجل ونقاط الولاء" },
  { feature: "suppliers", adds: "المشتريات وطلبات الشراء" },
  { feature: "expenses", adds: "المصروفات وصافي الربح" },
  { feature: "multi_user", adds: "أداء الكاشيرية" },
  { feature: "expiry", adds: "تنبيهات الصلاحية" },
];

/** سطر واحد هادئ: ما الذي سيظهر في اللوحة مع خطة أعلى. لا يظهر لو كل شيء متاح. */
export function LockedFeaturesNote() {
  const { data: plan } = usePlan();
  if (!plan) return null;
  const locked = DASHBOARD_FEATURES.filter(
    (f) => !plan.features.includes(f.feature),
  );
  if (locked.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-dashed bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
      <IconLock className="size-4 shrink-0" />
      <span>تظهر هنا أيضاً مع خطة أعلى:</span>
      {locked.map((f) => (
        <span key={f.feature} className="text-foreground">
          {f.adds}
          <span className="text-muted-foreground">
            {" "}
            («{FEATURE_INFO[f.feature].plan}»)
          </span>
        </span>
      ))}
      <Link
        href="/admin/settings#plans"
        className="ms-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        <IconSparkles className="size-3.5" />
        عرض الخطط
      </Link>
    </div>
  );
}
