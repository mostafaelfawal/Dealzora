"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { useImportFlow } from "../hooks/useImportFlow";
import type { LoadedSheet } from "../lib/importFile";
import { ImportDoneStep } from "./importDoneStep";
import { ImportFileStep } from "./importFileStep";
import { ImportMapStep } from "./importMapStep";

function ImportFlowSteps({
  initial,
  onClose,
}: {
  initial?: LoadedSheet | null;
  onClose: () => void;
}) {
  const flow = useImportFlow(initial);

  if (flow.step === "done" && flow.report) {
    return <ImportDoneStep report={flow.report} onClose={onClose} />;
  }
  if (flow.step === "file" || !flow.sheet) {
    return (
      <ImportFileStep
        reading={flow.reading}
        onFile={(file) => void flow.acceptFile(file)}
      />
    );
  }
  return <ImportMapStep flow={flow} sheet={flow.sheet} />;
}

/**
 * استيراد الأصناف من Excel: اختيار ملف ← ربط أعمدته بحقول التطبيق ← استيراد.
 * initial: ملف مُفلَت على الصفحة ومقروء مسبقاً، فتبدأ النافذة من ربط الأعمدة.
 */
export function ImportExcelDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LoadedSheet | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-2xl"
      >
        {/* نُركّب المحتوى عند الفتح فقط ليبدأ كل استيراد من جديد. */}
        {open && (
          <ImportFlowSteps
            initial={initial}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
