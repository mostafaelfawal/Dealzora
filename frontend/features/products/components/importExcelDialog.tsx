"use client";

import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconUpload,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { DragEvent } from "react";
import { toast } from "sonner";

import { MotionDiv, popIn } from "@/components/shared/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  autoMapColumns,
  IGNORE,
  IMPORT_FIELDS,
  type ColumnMapping,
  type MappingValue,
} from "../config/importFields";
import { productKeys } from "../config/productQueryKeys";
import { PRODUCT_ROUTES } from "../config/productRoutes";
import { readSheet, type ParsedSheet } from "../lib/excelSheet";
import { importProducts, type ImportReport } from "../lib/productImport";
import { downloadProductsTemplate } from "../lib/productExcel";

type Step = "file" | "map" | "done";
type DuplicateMode = "update" | "skip";

const STEPS: { id: Step; label: string }[] = [
  { id: "file", label: "اختيار الملف" },
  { id: "map", label: "ربط الأعمدة" },
  { id: "done", label: "تم" },
];

const FIELD_ITEMS = [
  { value: IGNORE, label: "تجاهل هذا العمود" },
  ...IMPORT_FIELDS.map((f) => ({
    value: f.key,
    label: f.required ? `${f.label} *` : f.label,
  })),
];

/** استيراد الأصناف من Excel: اختيار ملف ← ربط أعمدته بحقول التطبيق ← استيراد. */
export function ImportExcelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-2xl"
      >
        {/* نُركّب المحتوى عند الفتح فقط ليبدأ كل استيراد من الخطوة الأولى. */}
        {open && <ImportFlow onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol
      aria-label="خطوات الاستيراد"
      className="flex items-center gap-2 text-xs"
    >
      {STEPS.map((step, index) => {
        const done = index < currentIndex || current === "done";
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "flex size-5 items-center justify-center border font-mono text-[11px] tabular-nums",
                active && "border-primary bg-primary text-primary-foreground",
                done && !active && "border-primary text-primary",
              )}
            >
              {done && !active ? <IconCheck className="size-3" /> : index + 1}
            </span>
            <span
              className={cn(active ? "font-medium" : "text-muted-foreground")}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ImportFlow({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [duplicates, setDuplicates] = useState<DuplicateMode>("update");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<ImportReport | null>(null);

  async function acceptFile(file: File | undefined) {
    if (!file || reading) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error("الملف غير مدعوم", {
        description: "اختر ملف Excel بصيغة xlsx أو xls أو csv.",
      });
      return;
    }
    setReading(true);
    try {
      const parsed = await readSheet(file);
      if (parsed.columns.length === 0 || parsed.rows.length === 0) {
        toast.error("الملف فارغ", {
          description: "لم نجد أي صفوف بيانات تحت الصف الأول.",
        });
        return;
      }
      setFileName(file.name);
      setSheet(parsed);
      setMapping(autoMapColumns(parsed.columns));
      setStep("map");
    } catch {
      toast.error("تعذّرت قراءة الملف", {
        description: "تأكد أن الملف سليم وغير محمي بكلمة مرور.",
      });
    } finally {
      setReading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  /** كل حقل يُربط بعمود واحد فقط: ربطه بعمود جديد يفك ربطه من القديم. */
  function assign(column: string, value: MappingValue) {
    setMapping((prev) => {
      const next = { ...prev };
      if (value !== IGNORE) {
        for (const key of Object.keys(next)) {
          if (next[key] === value) next[key] = IGNORE;
        }
      }
      next[column] = value;
      return next;
    });
  }

  async function runImport() {
    if (!sheet || importing) return;
    setImporting(true);
    setProgress({ done: 0, total: sheet.rows.length });
    try {
      const result = await importProducts({
        rows: sheet.rows,
        mapping,
        duplicates,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      setReport(result);
      setStep("done");
    } catch {
      toast.error("تعذّر إكمال الاستيراد");
    } finally {
      setImporting(false);
    }
  }

  const covered = new Set(Object.values(mapping));
  const missingRequired = IMPORT_FIELDS.filter(
    (f) => f.required && !covered.has(f.key),
  );
  const coveredCount = IMPORT_FIELDS.filter((f) => covered.has(f.key)).length;
  const canImport = missingRequired.length === 0 && !importing;

  /* ---------- الخطوة 3: تم ---------- */
  if (step === "done" && report) {
    const saved = report.created + report.updated;
    return (
      <>
        <DialogHeader className="sr-only">
          <DialogTitle>انتهى الاستيراد</DialogTitle>
          <DialogDescription>نتيجة استيراد الأصناف من Excel.</DialogDescription>
        </DialogHeader>
        <StepIndicator current="done" />
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MotionDiv variants={popIn} initial="hidden" animate="show">
            <IconCircleCheck
              className={cn(
                "size-14",
                saved > 0 ? "text-success" : "text-muted-foreground",
              )}
            />
          </MotionDiv>
          <div className="space-y-1">
            <p className="text-base font-semibold">
              تم حفظ{" "}
              <bdi dir="ltr" className="font-mono">
                {saved}
              </bdi>{" "}
              صنف
            </p>
            <p className="text-xs text-muted-foreground">
              جديد:{" "}
              <bdi dir="ltr" className="font-mono">
                {report.created}
              </bdi>{" "}
              · محدَّث:{" "}
              <bdi dir="ltr" className="font-mono">
                {report.updated}
              </bdi>{" "}
              · متخطّى:{" "}
              <bdi dir="ltr" className="font-mono">
                {report.skipped}
              </bdi>{" "}
              · فشل:{" "}
              <bdi dir="ltr" className="font-mono">
                {report.failed.length}
              </bdi>
            </p>
          </div>
        </div>

        {report.failed.length > 0 && (
          <ul
            aria-label="الصفوف التي فشل استيرادها"
            className="max-h-40 divide-y overflow-y-auto border text-xs"
          >
            {report.failed.map((item) => (
              <li
                key={item.row}
                className="flex items-center justify-between gap-3 px-3 py-1.5"
              >
                <span className="text-muted-foreground">
                  الصف{" "}
                  <bdi dir="ltr" className="font-mono">
                    {item.row}
                  </bdi>
                </span>
                <span className="text-destructive">{item.message}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
            className="font-normal"
          >
            إغلاق
          </Button>
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={PRODUCT_ROUTES.list} onClick={onClose} />}
          >
            عرض الأصناف
          </Button>
        </div>
      </>
    );
  }

  /* ---------- الخطوة 1: اختيار الملف ---------- */
  if (step === "file" || !sheet) {
    return (
      <>
        <DialogHeader className="text-start">
          <DialogTitle>استيراد أصناف من Excel</DialogTitle>
          <DialogDescription>
            اختر ملفك وسنساعدك في ربط أعمدته بحقول البرنامج.
          </DialogDescription>
        </DialogHeader>
        <StepIndicator current="file" />

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
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            disabled={reading}
            onChange={(event) => void acceptFile(event.target.files?.[0])}
          />
          <IconFileSpreadsheet className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {reading
                ? "جارٍ قراءة الملف…"
                : dragging
                  ? "أفلت الملف هنا"
                  : "اسحب ملف Excel هنا أو اضغط للاختيار"}
            </p>
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

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <ul className="list-inside list-disc space-y-0.5">
            <li>الصف الأول يجب أن يحتوي أسماء الأعمدة.</li>
            <li>اسم الصنف وسعر البيع فقط هما المطلوبان.</li>
          </ul>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() =>
              void downloadProductsTemplate().catch(() =>
                toast.error("تعذّر تحميل النموذج"),
              )
            }
            className="gap-2 font-normal"
          >
            <IconDownload className="size-4" />
            تحميل نموذج جاهز
          </Button>
        </div>
      </>
    );
  }

  /* ---------- الخطوة 2: ربط الأعمدة ---------- */
  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle>اربط أعمدة الملف بحقول البرنامج</DialogTitle>
        <DialogDescription>
          ربطنا ما أمكن تلقائياً. راجع الاختيارات وعدّل ما تريد.
        </DialogDescription>
      </DialogHeader>
      <StepIndicator current="map" />

      <div className="flex flex-wrap items-center gap-3 border bg-muted/30 p-2.5">
        <IconFileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p
            dir="ltr"
            className="truncate text-start font-mono text-xs font-medium"
          >
            {fileName}
          </p>
          <p className="text-[11px] text-muted-foreground">
            <bdi dir="ltr" className="font-mono">
              {sheet.rows.length}
            </bdi>{" "}
            صف ·{" "}
            <bdi dir="ltr" className="font-mono">
              {sheet.columns.length}
            </bdi>{" "}
            أعمدة
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={importing}
          onClick={() => setStep("file")}
          className="font-normal"
        >
          تغيير الملف
        </Button>
      </div>

      <div aria-live="polite" className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            تم ربط{" "}
            <bdi dir="ltr" className="font-mono text-foreground">
              {coveredCount}
            </bdi>{" "}
            من{" "}
            <bdi dir="ltr" className="font-mono">
              {IMPORT_FIELDS.length}
            </bdi>{" "}
            حقول
          </span>
          {missingRequired.length > 0 && (
            <span className="text-destructive">
              ناقص: {missingRequired.map((f) => f.label).join("، ")}
            </span>
          )}
        </div>
        <span aria-hidden className="block h-1 w-full bg-muted">
          <span
            className="block h-full bg-primary transition-[width] duration-300"
            style={{ width: `${(coveredCount / IMPORT_FIELDS.length) * 100}%` }}
          />
        </span>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {IMPORT_FIELDS.map((field) => {
            const ok = covered.has(field.key);
            return (
              <Badge
                key={field.key}
                variant="outline"
                className={cn(
                  "gap-1 font-normal",
                  ok
                    ? "border-success/50 text-success"
                    : field.required
                      ? "border-destructive/50 text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {ok && <IconCheck />}
                {field.label}
                {field.required && !ok && " *"}
              </Badge>
            );
          })}
        </div>
      </div>

      <Separator />

      <ul className="divide-y border">
        <li
          aria-hidden
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground"
        >
          <span>عمود في ملف Excel</span>
          <span className="w-4" />
          <span>يقابله في البرنامج</span>
        </li>
        {sheet.columns.map((column) => {
          const value = mapping[column] ?? IGNORE;
          const ignored = value === IGNORE;
          return (
            <li
              key={column}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2"
            >
              <div className={cn("min-w-0", ignored && "opacity-60")}>
                <p className="truncate text-sm font-medium">{column}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  مثال: {sheet.rows[0]?.[column] || "—"}
                </p>
              </div>
              <IconArrowLeft
                aria-hidden
                className={cn(
                  "size-4",
                  ignored ? "text-muted-foreground/40" : "text-primary",
                )}
              />
              <Select
                items={FIELD_ITEMS}
                value={value}
                disabled={importing}
                onValueChange={(next) => {
                  if (next) assign(column, next as MappingValue);
                }}
              >
                <SelectTrigger
                  aria-label={`حقل البرنامج المقابل لعمود ${column}`}
                  className={cn(
                    "w-full data-[size=default]:h-9",
                    ignored && "text-muted-foreground",
                  )}
                >
                  <SelectValue className="text-start" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {FIELD_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          لو الباركود موجود مسبقاً في أصنافك:
        </p>
        <div
          role="group"
          aria-label="التعامل مع الباركود المكرر"
          className="grid grid-cols-2 gap-2"
        >
          {(
            [
              { id: "update", label: "تحديث الصنف الموجود" },
              { id: "skip", label: "تخطي وعدم تغييره" },
            ] as const
          ).map((option) => (
            <Button
              key={option.id}
              type="button"
              size="lg"
              disabled={importing}
              variant={duplicates === option.id ? "default" : "outline"}
              aria-pressed={duplicates === option.id}
              onClick={() => setDuplicates(option.id)}
              className="font-normal"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={importing}
          onClick={() => setStep("file")}
          className="font-normal sm:me-auto"
        >
          رجوع
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!canImport}
          onClick={() => void runImport()}
          className="gap-2 px-5"
        >
          {importing ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الاستيراد…{" "}
              <bdi dir="ltr" className="font-mono tabular-nums">
                {progress.done}/{progress.total}
              </bdi>
            </>
          ) : (
            <>
              استيراد{" "}
              <bdi dir="ltr" className="font-mono">
                {sheet.rows.length}
              </bdi>{" "}
              صنف
            </>
          )}
        </Button>
      </div>
    </>
  );
}
