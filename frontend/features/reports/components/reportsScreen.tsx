"use client";

import { IconFileSpreadsheet, IconLoader2 } from "@tabler/icons-react";
import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

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
import { exportReportTables } from "../lib/reportExcel";
import { ReportPdfButton } from "./reportPdf";
import { ReportTabContent } from "./reportTabContent";
import { PlanLock, UpgradeNotice } from "@/components/shared/PlanGate";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { toastFileSaved } from "@/lib/fileToast";
import { usePlan, useFeature } from "@/lib/plan";

/** تاريخ قبل n يوم بتوقيت الجهاز (YYYY-MM-DD) لمقارنته بـ range.from. */
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** تصدير جداول التبويب الظاهر إلى Excel (ميزة خطط مدفوعة). */
function ExportButton({
  contentRef,
  title,
  periodLabel,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  title: string;
  periodLabel: string;
}) {
  const canExport = useFeature("excel");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!contentRef.current || busy) return;
    setBusy(true);
    try {
      const result = await exportReportTables(
        contentRef.current,
        title,
        periodLabel,
      );
      if (!result) {
        toast.info("لا توجد جداول فيها بيانات لتصديرها في هذا التقرير");
        return;
      }
      toastFileSaved({
        title: "تم تصدير التقرير",
        file: result.file,
        detail: `${result.sheets} ورقة`,
      });
    } catch (e) {
      toast.error(extractErrorMessage(e, "تعذّر تصدير التقرير"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={canExport ? run : undefined}
      disabled={busy || !canExport}
      className="h-10 gap-2 font-normal"
    >
      {busy ? (
        <IconLoader2 className="size-4 animate-spin" />
      ) : (
        <IconFileSpreadsheet className="size-4" />
      )}
      Excel
      {!canExport && <PlanLock feature="excel" />}
    </Button>
  );
}

/** التقارير: فترة واحدة تتحكم في كل التبويبات، وكل رقم له جدول تحته. */
export function ReportsScreen() {
  const [selected, setTab] = useState<ReportTab>("sales");
  const contentRef = useRef<HTMLDivElement>(null);
  // التقرير المجمّع: للمالك على الجهاز الرئيسي المربوط بسيرفر الفروع.
  const branch = useBranchStatus();
  const owner = isOwner(useSessionUser().role);
  const showBranches =
    owner && Boolean(branch.data?.connected && branch.data.isAdmin);
  const plan = usePlan().data;
  // تبويبات ميزات خارج الخطة لا تظهر (أثناء تحميل الخطة نعرض الكل).
  const planTabs = REPORT_TABS.filter(
    (t) => !t.feature || !plan || plan.features.includes(t.feature),
  );
  const tabs = showBranches ? [...planTabs, BRANCHES_TAB] : planTabs;
  const tab = tabs.some((t) => t.id === selected) ? selected : "sales";
  const tabLabel = tabs.find((t) => t.id === tab)?.label ?? "";
  // بَسطة: آخر 7 أيام فقط، فنبدأ بـ «أسبوع» بدل «شهر».
  const [period, setPeriod] = useState<PeriodValue>(
    periodOf(plan?.isFree ? "week" : "month"),
  );
  const fullReports = useFeature("full_reports");
  const cutoff = plan?.limits.reportDays
    ? daysAgoISO(plan.limits.reportDays - 1)
    : null;
  const isOutOfPlan = (t: ReportTab) =>
    !fullReports &&
    t !== "branches" &&
    (t === "debts" ||
      (PERIOD_TABS.has(t) && cutoff !== null && period.range.from < cutoff));
  const outOfPlan = isOutOfPlan(tab);
  const periodLabel = `الفترة من ${formatDate(parseIsoDay(period.range.from))} إلى ${formatDate(parseIsoDay(period.range.to))}`;
  // الـ PDF: الأقسام المتاحة في الخطة لهذه الفترة فقط.
  const pdfTabs = tabs.filter((t) => !isOutOfPlan(t.id));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="التقارير"
        description="المبيعات والأرباح والخصومات، الأصناف والأقسام، المشتريات، العروض، المرتجعات، العملاء والنقاط، الكاشيرية والورديات، المخزون، المديونيات، والخزنة."
        actions={
          <div className="flex gap-2">
            <ExportButton
              contentRef={contentRef}
              title={tabLabel}
              periodLabel={periodLabel}
            />
            <ReportPdfButton
              tabs={pdfTabs}
              currentTab={tab}
              period={period}
              periodLabel={periodLabel}
            />
          </div>
        }
      />
      <SegmentedTabs
        label="التقرير"
        items={tabs}
        value={tab}
        onChange={setTab}
        className="flex-wrap"
      />
      {PERIOD_TABS.has(tab) && (
        <div className="flex justify-end">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      )}
      <div ref={contentRef}>
        {outOfPlan ? (
          <UpgradeNotice feature="full_reports" className="mt-4" />
        ) : (
          <ReportTabContent tab={tab} period={period} />
        )}
      </div>
    </div>
  );
}
