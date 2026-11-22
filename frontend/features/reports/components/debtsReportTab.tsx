"use client";

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconArrowUpRight,
  IconClock,
  IconPhone,
  IconUsers,
} from "@tabler/icons-react";

import { ChartCard } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { formatDayLabel } from "@/lib/dates";
import { openExternal } from "@/lib/external";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useDebtsReport } from "../hooks/useReports";
import { topDebtorItems } from "../lib/reportSeries";
import type { DebtsReport } from "../types/report";
import { ReportListEmpty, ReportLoading, ReportPanel } from "./reportPanel";
import { AppTooltip } from "@/components/shared/AppTooltip";

type Debtor = DebtsReport["customers"][number];

function DebtsStats({ r }: { r: DebtsReport }) {
  return (
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
  );
}

/** نسبة استخدام حد الائتمان (0..100+). null = بلا حد. */
const creditUse = (c: Debtor) =>
  c.creditLimit > 0 ? Math.round((c.balance / c.creditLimit) * 100) : null;

/**
 * صف مدين: الحرف الأول (أحمر للمتأخر)، الاسم، آخر دفعة والتليفون (يتصل بالضغط)،
 * والمديونية مع شريط استخدام حد الائتمان.
 */
function DebtorRow({ c }: { c: Debtor }) {
  const use = creditUse(c);
  const over = use !== null && use >= 100;
  return (
    <li className="flex items-center gap-3 py-2.5 text-xs">
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          c.isOverdue
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        {c.name.trim().charAt(0) || "؟"}
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <AppTooltip message={c.name} onlyWhenTruncated>
            <span className="truncate font-medium">{c.name}</span>
          </AppTooltip>
          {c.isOverdue && (
            <Badge
              variant="outline"
              className="shrink-0 border-destructive/50 px-1 font-normal text-destructive"
            >
              متأخر
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              c.isOverdue && "text-destructive",
            )}
          >
            <IconClock className="size-3" />
            {c.lastPaymentAt
              ? `آخر دفعة ${formatDayLabel(c.lastPaymentAt)}`
              : "لم يدفع بعد"}
          </span>
          {c.phone && (
            <AppTooltip message={`اتصال بـ ${c.name}`}>
              <a
                href={`tel:${c.phone}`}
                onClick={(e) => {
                  e.preventDefault();
                  void openExternal(`tel:${c.phone}`);
                }}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <IconPhone className="size-3" />
                <bdi dir="ltr" className="font-mono">
                  {c.phone}
                </bdi>
              </a>
            </AppTooltip>
          )}
        </div>
      </div>

      <div className="flex w-28 shrink-0 flex-col items-end gap-1">
        <Money
          amount={c.balance}
          className={cn(
            "text-sm font-semibold",
            c.isOverdue && "text-destructive",
          )}
        />
        {use !== null && (
          <>
            <div
              role="meter"
              aria-label="استخدام حد الائتمان"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(use, 100)}
              className="h-1 w-full overflow-hidden bg-muted"
            >
              <div
                className={cn(
                  "h-full",
                  over
                    ? "bg-destructive"
                    : use >= 80
                      ? "bg-warning"
                      : "bg-primary",
                )}
                style={{ width: `${Math.min(use, 100)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[10px] text-muted-foreground",
                over && "text-destructive",
              )}
            >
              {over ? "تجاوز" : `${use}% من`} حد {formatNumber(c.creditLimit)}
            </span>
          </>
        )}
      </div>
    </li>
  );
}

export function DebtsReportTab() {
  const q = useDebtsReport();
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;

  return (
    <div className="space-y-4">
      <DebtsStats r={r} />

      {r.customers.length > 0 && (
        <ChartCard
          title="أكبر المدينين"
          subtitle="الأحمر = متأخر في السداد (أكثر من 30 يوماً بلا دفعة)"
        >
          <RankBarChart
            valueLabel="المديونية"
            items={topDebtorItems(r.customers)}
          />
        </ChartCard>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ReportPanel title="العملاء المدينون (المتأخر أولاً)">
          <ul className="divide-y">
            {r.customers.length === 0 && (
              <ReportListEmpty
                text="لا توجد ديون على العملاء"
                icon={IconCircleCheck}
              />
            )}
            {r.customers.map((c) => (
              <DebtorRow key={c.id} c={c} />
            ))}
          </ul>
        </ReportPanel>

        <ReportPanel title="مستحقات الموردين">
          <ul className="divide-y">
            {r.suppliers.length === 0 && (
              <ReportListEmpty
                text="لا توجد مستحقات للموردين"
                icon={IconCircleCheck}
              />
            )}
            {r.suppliers.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <AppTooltip message={s.name} onlyWhenTruncated>
                  <span className="truncate font-medium">{s.name}</span>
                </AppTooltip>
                <Money amount={s.balance} className="text-xs" />
              </li>
            ))}
          </ul>
        </ReportPanel>
      </div>
    </div>
  );
}
