"use client";

import { IconPrinter } from "@tabler/icons-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  PeriodPicker,
  periodOf,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";

import { isOwner } from "@/config/roles";
import { useBranchStatus } from "@/features/branchTransfers/hooks/useBranchTransfers";
import { useSessionUser } from "@/hooks/useShellData";

import {
  BRANCHES_TAB,
  PERIOD_TABS,
  REPORT_TABS,
} from "../config/reportOptions";
import type { ReportTab } from "../types/report";
import { BranchesReportTab } from "./branchesReportTab";
import { DebtsReportTab } from "./debtsReportTab";
import { ProductsReportTab } from "./productsReportTab";
import { SalesReportTab } from "./salesReportTab";
import { StockReportTab } from "./stockReportTab";
import { TreasuryReportTab } from "./treasuryReportTab";
import { UpgradeNotice } from "@/components/shared/PlanGate";
import { usePlan, useFeature } from "@/lib/plan";

/** تاريخ قبل n يوم بتوقيت الجهاز (YYYY-MM-DD) لمقارنته بـ range.from. */
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PrintButton() {
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={() => window.print()}
      className="h-10 gap-2 font-normal"
    >
      <IconPrinter className="size-4" />
      طباعة
    </Button>
  );
}

function ReportTabContent({
  tab,
  period,
}: {
  tab: ReportTab;
  period: PeriodValue;
}) {
  switch (tab) {
    case "sales":
      return <SalesReportTab range={period.range} />;
    case "products":
      return <ProductsReportTab range={period.range} />;
    case "stock":
      return <StockReportTab />;
    case "debts":
      return <DebtsReportTab />;
    case "treasury":
      return <TreasuryReportTab range={period.range} />;
    case "branches":
      return <BranchesReportTab range={period.range} />;
  }
}

/** التقارير: فترة واحدة تتحكم في كل التبويبات، وكل رقم له جدول تحته. */
export function ReportsScreen() {
  const [tab, setTab] = useState<ReportTab>("sales");
  // التقرير المجمّع: للمالك على الجهاز الرئيسي المربوط بسيرفر الفروع.
  const branch = useBranchStatus();
  const owner = isOwner(useSessionUser().role);
  const showBranches =
    owner && Boolean(branch.data?.connected && branch.data.isAdmin);
  const tabs = showBranches ? [...REPORT_TABS, BRANCHES_TAB] : REPORT_TABS;
  const plan = usePlan().data;
  // بَسطة: آخر 7 أيام فقط، فنبدأ بـ «أسبوع» بدل «شهر».
  const [period, setPeriod] = useState<PeriodValue>(
    periodOf(plan?.isFree ? "week" : "month"),
  );
  const fullReports = useFeature("full_reports");
  const cutoff = plan?.limits.reportDays
    ? daysAgoISO(plan.limits.reportDays - 1)
    : null;
  const outOfPlan =
    !fullReports &&
    tab !== "branches" &&
    (tab === "debts" ||
      (PERIOD_TABS.has(tab) && cutoff !== null && period.range.from < cutoff));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="التقارير"
        description="المبيعات والأرباح، الأكثر والأقل مبيعاً، النواقص والراكد، المديونيات المتأخرة، وملخص الخزنة."
        actions={<PrintButton />}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs
          label="التقرير"
          items={tabs}
          value={tab}
          onChange={setTab}
        />
        {PERIOD_TABS.has(tab) && (
          <PeriodPicker value={period} onChange={setPeriod} />
        )}
      </div>
      {outOfPlan ? (
        <UpgradeNotice feature="full_reports" className="mt-4" />
      ) : (
        <ReportTabContent tab={tab} period={period} />
      )}
    </div>
  );
}
