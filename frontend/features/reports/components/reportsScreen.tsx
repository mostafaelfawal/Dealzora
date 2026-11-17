"use client";

import { IconFileSpreadsheet, IconLoader2 } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  PeriodPicker,
  periodOf,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
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
import { ReportNav } from "./reportNav";
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

const isReportTab = (v: string | null): v is ReportTab =>
  v !== null && [...REPORT_TABS, BRANCHES_TAB].some((t) => t.id === v);

/**
 * التقارير: قائمة مجمّعة بالسؤال، ورأس للتقرير المفتوح بفترته، وفترة واحدة لكل التقارير.
 * التقرير المفتوح في الرابط (?tab=) فيبقى بعد التحديث، وتفتحه روابط لوحة التحكم مباشرة.
 */
export function ReportsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const selected: ReportTab = isReportTab(tabParam) ? tabParam : "sales";
  const setTab = (next: ReportTab) =>
    router.replace(next === "sales" ? pathname : `${pathname}?tab=${next}`, {
      scroll: false,
    });
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
  const current = tabs.find((t) => t.id === selected) ?? tabs[0];
  const tab = current.id;
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
  const from = formatDate(parseIsoDay(period.range.from));
  const to = formatDate(parseIsoDay(period.range.to));
  const periodLabel = `الفترة من ${from} إلى ${to}`;
  // الـ PDF: الأقسام المتاحة في الخطة لهذه الفترة فقط.
  const pdfTabs = tabs.filter((t) => !isOutOfPlan(t.id));
  const usesPeriod = PERIOD_TABS.has(tab);
  const Icon = current.icon;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="التقارير"
        description="اختر سؤالك من القائمة وحدّد الفترة، فتتحدّث الأرقام فوراً، وتحت كل رقم تفاصيله."
        actions={
          <div className="flex gap-2">
            <ExportButton
              contentRef={contentRef}
              title={current.label}
              periodLabel={usesPeriod ? periodLabel : "الوضع الحالي"}
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

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-4">
          <ReportNav tabs={tabs} value={tab} onChange={setTab} />
        </aside>

        <div className="min-w-0 space-y-4">
          <section
            aria-label="التقرير المفتوح"
            className="flex flex-wrap items-center gap-3 border bg-card p-3"
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold">{current.label}</h2>
              <p className="text-xs text-muted-foreground">
                {usesPeriod ? (
                  <>
                    من <b className="font-medium text-foreground">{from}</b> إلى{" "}
                    <b className="font-medium text-foreground">{to}</b>
                  </>
                ) : (
                  "الوضع الحالي للمحل الآن، ولا يتأثر بالفترة"
                )}
              </p>
            </div>
            {usesPeriod ? (
              <PeriodPicker value={period} onChange={setPeriod} />
            ) : (
              <span className="inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] text-muted-foreground">
                <span aria-hidden className="size-1.5 bg-success" />
                لقطة الآن
              </span>
            )}
          </section>

          <div ref={contentRef}>
            {outOfPlan ? (
              <UpgradeNotice feature="full_reports" />
            ) : (
              <ReportTabContent tab={tab} period={period} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
