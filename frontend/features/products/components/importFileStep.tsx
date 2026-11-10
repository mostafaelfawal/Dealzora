"use client";

import {
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconUpload,
} from "@tabler/icons-react";
import { useState, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toastFileSaved } from "@/lib/fileToast";
import { cn } from "@/lib/utils";

import { SHEET_ACCEPT } from "../config/importOptions";
import { downloadProductsTemplate } from "../lib/productExcel";
import { ImportSteps } from "./importSteps";

function DropZone({
  reading,
  onFile,
}: {
  reading: boolean;
  onFile: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files[0]);
  }

  const prompt = reading
    ? "جارٍ قراءة الملف…"
    : dragging
      ? "أفلت الملف هنا"
      : "اسحب ملف Excel هنا أو اضغط للاختيار";

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed p-10 text-center transition-colors",
        "hover:border-primary/60 hover:bg-muted/40 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50",
        dragging && "border-primary bg-muted/60",
      )}
    >
      <input
        type="file"
        accept={SHEET_ACCEPT}
        className="sr-only"
        disabled={reading}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      <IconFileSpreadsheet className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{prompt}</p>
        <p className="text-xs text-muted-foreground">xlsx · xls · csv</p>
      </div>
      <span className="inline-flex h-9 items-center gap-2 border bg-background px-3 text-xs font-medium">
        {reading ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconUpload className="size-4" />
        )}
        اختيار ملف
      </span>
    </label>
  );
}

function downloadTemplate() {
  downloadProductsTemplate()
    .then((file) => toastFileSaved({ title: "تم تحميل النموذج", file }))
    .catch(() => toast.error("تعذّر تحميل النموذج"));
}

/** الخطوة 1: اختيار الملف أو تحميل نموذج جاهز. */
export function ImportFileStep({
  reading,
  onFile,
}: {
  reading: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle>استيراد أصناف من Excel</DialogTitle>
        <DialogDescription>
          اختر ملفك وسنساعدك في ربط أعمدته بحقول البرنامج.
        </DialogDescription>
      </DialogHeader>
      <ImportSteps current="file" />

      <DropZone reading={reading} onFile={onFile} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <ul className="list-inside list-disc space-y-0.5">
          <li>الصف الأول يجب أن يحتوي أسماء الأعمدة.</li>
          <li>اسم الصنف وسعر البيع فقط هما المطلوبان.</li>
        </ul>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={downloadTemplate}
          className="gap-2 font-normal"
        >
          <IconDownload className="size-4" />
          تحميل نموذج جاهز
        </Button>
      </div>
    </>
  );
}
