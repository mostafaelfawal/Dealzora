"use client";

import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconUpload,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import type { DragEvent } from "react";
import { toast } from "sonner";

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
import { PRODUCT_ROUTES } from "../config/productRoutes";
import { MOCK_EXCEL } from "../mocks/excelMock";
import { MotionDiv, popIn } from "@/components/shared/motion";

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

/**
 * استيراد الأصناف من Excel: اختيار ملف ← ربط أعمدته بحقول التطبيق ← تأكيد.
 * الواجهة فقط حالياً. TODO: قراءة الملف وإرساله كـ import_job على السيرفر (تحقق ← تقرير أخطاء ← تطبيق).
 */
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
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [duplicates, setDuplicates] = useState<DuplicateMode>("update");
  const [dragging, setDragging] = useState(false);

  function acceptFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error("الملف غير مدعوم", {
        description: "اختر ملف Excel بصيغة xlsx أو xls أو csv.",
      });
      return;
    }
    setFileName(file.name);
    // أعمدة تجريبية الآن، وبعدها تُقرأ من الملف الفعلي.
    setMapping(autoMapColumns(MOCK_EXCEL.columns));
    setStep("map");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
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

  const covered = new Set(Object.values(mapping));
  const missingRequired = IMPORT_FIELDS.filter(
    (f) => f.required && !covered.has(f.key),
  );
  const coveredCount = IMPORT_FIELDS.filter((f) => covered.has(f.key)).length;
  const canImport = missingRequired.length === 0;

  /* ---------- الخطوة 3: تم ---------- */
  if (step === "done") {
    return (
      <>
        <DialogHeader className="sr-only">
          <DialogTitle>تم الاستيراد</DialogTitle>
          <DialogDescription>اكتمل استيراد الأصناف من Excel.</DialogDescription>
        </DialogHeader>
        <StepIndicator current="done" />
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <MotionDiv variants={popIn} initial="hidden" animate="show">
            <IconCircleCheck className="size-14 text-success" />
          </MotionDiv>
          <div className="space-y-1">
            <p className="text-base font-semibold">
              تم استيراد{" "}
              <bdi dir="ltr" className="font-mono">
                {MOCK_EXCEL.rowCount}
              </bdi>{" "}
              صنف
            </p>
            <p className="text-xs text-muted-foreground">
              أصبحت الأصناف في قائمتك وجاهزة للبيع من الكاشير.
            </p>
          </div>
        </div>
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
  if (step === "file") {
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
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
          <IconFileSpreadsheet className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {dragging
                ? "أفلت الملف هنا"
                : "اسحب ملف Excel هنا أو اضغط للاختيار"}
            </p>
            <p className="text-xs text-muted-foreground">xlsx · xls · csv</p>
          </div>
          <span className="inline-flex h-9 items-center gap-2 border bg-background px-3 text-xs font-medium">
            <IconUpload className="size-4" />
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
            onClick={() => toast.info("سيتوفر نموذج Excel قريباً")}
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
              {MOCK_EXCEL.rowCount}
            </bdi>{" "}
            صف ·{" "}
            <bdi dir="ltr" className="font-mono">
              {MOCK_EXCEL.columns.length}
            </bdi>{" "}
            أعمدة
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setStep("file")}
          className="font-normal"
        >
          تغيير الملف
        </Button>
      </div>

      {/* حالة الحقول: الناقص المطلوب يظهر فوراً. */}
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
          {!canImport && (
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

      {/* عمود Excel (ومثال من أول صف) ← حقل في البرنامج */}
      <ul className="divide-y border">
        <li
          aria-hidden
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground"
        >
          <span>عمود في ملف Excel</span>
          <span className="w-4" />
          <span>يقابله في البرنامج</span>
        </li>
        {MOCK_EXCEL.columns.map((column) => {
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
                  مثال: {MOCK_EXCEL.sample[column] ?? "—"}
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
          onClick={() => setStep("file")}
          className="font-normal sm:me-auto"
        >
          رجوع
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!canImport}
          onClick={() => {
            // TODO: أرسل الملف + الـ mapping + duplicates كـ import_job.
            setStep("done");
          }}
          className="px-5"
        >
          استيراد{" "}
          <bdi dir="ltr" className="font-mono">
            {MOCK_EXCEL.rowCount}
          </bdi>{" "}
          صنف
        </Button>
      </div>
    </>
  );
}
