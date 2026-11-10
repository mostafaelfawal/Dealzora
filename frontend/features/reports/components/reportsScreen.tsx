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

import { PERIOD_TABS, REPORT_TABS } from "../config/reportOptions";
import type { ReportTab } from "../types/report";
import { DebtsReportTab } from "./debtsReportTab";
import { ProductsReportTab } from "./productsReportTab";
import { SalesReportTab } from "./salesReportTab";
import { StockReportTab } from "./stockReportTab";
import { TreasuryReportTab } from "./treasuryReportTab";

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
  }
}

/** التقارير: فترة واحدة تتحكم في كل التبويبات، وكل رقم له جدول تحته. */
export function ReportsScreen() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [period, setPeriod] = useState<PeriodValue>(periodOf("month"));

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
          items={REPORT_TABS}
          value={tab}
          onChange={setTab}
        />
        {PERIOD_TABS.has(tab) && (
          <PeriodPicker value={period} onChange={setPeriod} />
        )}
      </div>
      <ReportTabContent tab={tab} period={period} />
    </div>
  );
}
