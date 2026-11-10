"use client";

import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconUsers,
} from "@tabler/icons-react";

import { ChartCard } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { formatDayLabel } from "@/lib/dates";

import { useDebtsReport } from "../hooks/useReports";
import { topDebtorItems } from "../lib/reportSeries";
import type { DebtsReport } from "../types/report";
import { ReportListEmpty, ReportLoading, ReportPanel } from "./reportPanel";

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

function DebtorRow({ c }: { c: Debtor }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
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
              <ReportListEmpty text="لا توجد ديون" />
            )}
            {r.customers.map((c) => (
              <DebtorRow key={c.id} c={c} />
            ))}
          </ul>
        </ReportPanel>

        <ReportPanel title="مستحقات الموردين">
          <ul className="divide-y">
            {r.suppliers.length === 0 && (
              <ReportListEmpty text="لا توجد مستحقات" />
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
        </ReportPanel>
      </div>
    </div>
  );
}
