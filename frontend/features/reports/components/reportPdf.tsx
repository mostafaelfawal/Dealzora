"use client";

import { IconFileTypePdf, IconLoader2 } from "@tabler/icons-react";
import { MotionGlobalConfig } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { StaticCharts } from "@/components/shared/charts/chartAnimation";
import type { PeriodValue } from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShopName } from "@/features/settings/hooks/useSettings";
import { useSessionUser } from "@/hooks/useShellData";
import { toastFileSaved } from "@/lib/fileToast";
import {
  A4_CONTENT_WIDTH_PX,
  buildPdfDocument,
  collectAppCss,
  PDF_LAYOUT_CSS,
  PdfError,
  saveHtmlAsPdf,
  type PdfSection,
} from "@/lib/pdfDocument";

import type { ReportTab } from "../types/report";
import { ReportTabContent } from "./reportTabContent";

type TabOption = { id: ReportTab; label: string };
type Scope = "current" | "all";

/** مهلة قصيرة بعد وصول البيانات حتى تقيس الرسوم عرضها وتُرسم (الحركة متوقفة). */
const CHART_SETTLE_MS = 600;
/** أقصى انتظار لتحميل بيانات كل الأقسام. */
const LOAD_TIMEOUT_MS = 45_000;

const SCOPES: { id: Scope; label: string }[] = [
  { id: "current", label: "هذا القسم فقط" },
  { id: "all", label: "التقرير الكامل" },
];

/**
 * مسرح خفي يرسم الأقسام المطلوبة بعرض صفحة A4 (خارج الشاشة)، وينتظر حتى تصل
 * بياناتها وتستقر الرسوم، ثم يسلّم الـ HTML الجاهز. الحركة متوقفة أثناءه.
 */
function PdfStage({
  tabs,
  period,
  onReady,
}: {
  tabs: TabOption[];
  period: PeriodValue;
  onReady: (sections: PdfSection[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onReady);
  useEffect(() => {
    done.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const previous = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
    const started = Date.now();
    let settle: ReturnType<typeof setTimeout> | undefined;
    const poll = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const loading = el.querySelector('[aria-busy="true"]');
      if (loading && Date.now() - started < LOAD_TIMEOUT_MS) return;
      clearInterval(poll);
      settle = setTimeout(() => {
        const sections = Array.from(
          el.querySelectorAll<HTMLElement>("[data-pdf-tab]"),
        ).map((s) => ({
          title: s.dataset.pdfTitle ?? "",
          html: s.innerHTML,
        }));
        done.current(sections);
      }, CHART_SETTLE_MS);
    }, 250);
    return () => {
      clearInterval(poll);
      clearTimeout(settle);
      MotionGlobalConfig.skipAnimations = previous;
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      aria-hidden
      inert
      className="pdf-root bg-background"
      style={{
        position: "fixed",
        top: 0,
        left: -20_000,
        width: A4_CONTENT_WIDTH_PX,
        pointerEvents: "none",
      }}
    >
      <style>{PDF_LAYOUT_CSS}</style>
      {/* الرسوم مكتملة فوراً: حركتها لا تتقدم خارج الشاشة فتُلتقط ناقصة. */}
      <StaticCharts>
        {tabs.map((t) => (
          <div key={t.id} data-pdf-tab={t.id} data-pdf-title={t.label}>
            <ReportTabContent tab={t.id} period={period} />
          </div>
        ))}
      </StaticCharts>
    </div>,
    document.body,
  );
}

const fileDate = () => new Date().toISOString().slice(0, 10);

/**
 * زر «PDF»: ملف A4 احترافي للقسم المفتوح أو للتقرير الكامل (كل الأقسام المتاحة)،
 * بالرسوم والجداول، يُحفظ في التنزيلات.
 */
export function ReportPdfButton({
  tabs,
  currentTab,
  period,
  periodLabel,
}: {
  /** الأقسام المتاحة في خطة المحل وفترتها. */
  tabs: TabOption[];
  currentTab: ReportTab;
  period: PeriodValue;
  periodLabel: string;
}) {
  const shopName = useShopName().data ?? "Dealzora";
  const userName = useSessionUser().name;
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("current");
  const [picked, setPicked] = useState<Set<ReportTab>>(
    () => new Set(tabs.map((t) => t.id)),
  );
  const [job, setJob] = useState<{
    tabs: TabOption[];
    toastId: string | number;
  } | null>(null);

  const current = tabs.find((t) => t.id === currentTab);
  const chosen =
    scope === "current"
      ? current
        ? [current]
        : []
      : tabs.filter((t) => picked.has(t.id));

  function start() {
    if (chosen.length === 0) return;
    setOpen(false);
    const toastId = toast.loading("جارٍ تجهيز ملف الـ PDF…", {
      description:
        chosen.length > 1
          ? `${chosen.length} أقسام بالرسوم والجداول`
          : chosen[0].label,
    });
    setJob({ tabs: chosen, toastId });
  }

  async function finish(sections: PdfSection[]) {
    const active = job;
    setJob(null);
    if (!active) return;
    const title =
      active.tabs.length === 1
        ? `تقرير ${active.tabs[0].label}`
        : "التقرير الشامل";
    try {
      const html = buildPdfDocument({
        shopName,
        title,
        periodLabel,
        generatedBy: userName || undefined,
        sections,
        appCss: await collectAppCss(),
      });
      const file = await saveHtmlAsPdf(html, `${title} ${fileDate()}.pdf`);
      if (file) {
        toastFileSaved({
          id: active.toastId,
          title: "تم تجهيز ملف الـ PDF",
          file,
          detail: `${sections.length} ${sections.length > 1 ? "أقسام" : "قسم"}`,
        });
      } else {
        toast.dismiss(active.toastId);
      }
    } catch (e) {
      toast.error(
        e instanceof PdfError ? e.message : "تعذّر تجهيز ملف الـ PDF",
        { id: active.toastId, duration: 8000 },
      );
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        disabled={job !== null}
        className="h-10 gap-2 font-normal"
      >
        {job ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconFileTypePdf className="size-4" />
        )}
        PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle>تقرير PDF بحجم A4</DialogTitle>
            <DialogDescription>
              ملف جاهز للطباعة أو الإرسال: ترويسة باسم المحل والفترة، رسوم
              بيانية وجداول، وأرقام صفحات. {periodLabel}.
            </DialogDescription>
          </DialogHeader>

          <SegmentedTabs
            label="محتوى الملف"
            items={SCOPES}
            value={scope}
            onChange={setScope}
          />

          {scope === "current" ? (
            <p className="text-sm">
              القسم: <b>{current?.label ?? "—"}</b>
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 border p-3">
              {tabs.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.has(t.id)}
                      onCheckedChange={(on) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(t.id);
                          else next.delete(t.id);
                          return next;
                        })
                      }
                    />
                    {t.label}
                  </label>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button
              onClick={start}
              disabled={chosen.length === 0}
              className="gap-2"
            >
              <IconFileTypePdf className="size-4" />
              تجهيز الملف
              {scope === "all" && ` (${chosen.length} أقسام)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {job && <PdfStage tabs={job.tabs} period={period} onReady={finish} />}
    </>
  );
}
