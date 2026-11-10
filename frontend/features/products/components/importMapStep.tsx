"use client";

import {
  IconArrowLeft,
  IconCheck,
  IconFileSpreadsheet,
} from "@tabler/icons-react";

import { SavingLabel } from "@/components/shared/form";
import { Num } from "@/components/shared/Num";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
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
  IGNORE,
  IMPORT_FIELDS,
  type MappingValue,
} from "../config/importFields";
import { DUPLICATE_MODES, IMPORT_FIELD_ITEMS } from "../config/importOptions";
import type { ImportFlow } from "../hooks/useImportFlow";
import type { ParsedSheet } from "../lib/excelSheet";
import type { MappingCoverage } from "../lib/importMapping";
import { ImportSteps } from "./importSteps";

function FileSummary({
  fileName,
  sheet,
  disabled,
  onChange,
}: {
  fileName: string;
  sheet: ParsedSheet;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
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
          <Num>{sheet.rows.length}</Num> صف · <Num>{sheet.columns.length}</Num>{" "}
          أعمدة
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onChange}
        className="font-normal"
      >
        تغيير الملف
      </Button>
    </div>
  );
}

function CoverageSummary({ coverage }: { coverage: MappingCoverage }) {
  const { covered, coveredCount, missingRequired } = coverage;
  const total = IMPORT_FIELDS.length;

  return (
    <div aria-live="polite" className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          تم ربط <Num className="text-foreground">{coveredCount}</Num> من{" "}
          <Num>{total}</Num> حقول
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
          style={{ width: `${(coveredCount / total) * 100}%` }}
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
  );
}

function ColumnRow({
  column,
  sample,
  value,
  disabled,
  onChange,
}: {
  column: string;
  sample: string | undefined;
  value: MappingValue;
  disabled: boolean;
  onChange: (value: MappingValue) => void;
}) {
  const ignored = value === IGNORE;
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2">
      <div className={cn("min-w-0", ignored && "opacity-60")}>
        <p className="truncate text-sm font-medium">{column}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          مثال: {sample || "—"}
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
        items={IMPORT_FIELD_ITEMS}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next) onChange(next as MappingValue);
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
          {IMPORT_FIELD_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}

function DuplicateModePicker({
  flow,
}: {
  flow: Pick<ImportFlow, "duplicates" | "setDuplicates" | "importing">;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        لو الباركود موجود مسبقاً في أصنافك:
      </p>
      <div
        role="group"
        aria-label="التعامل مع الباركود المكرر"
        className="grid grid-cols-2 gap-2"
      >
        {DUPLICATE_MODES.map((option) => {
          const selected = flow.duplicates === option.id;
          return (
            <Button
              key={option.id}
              type="button"
              size="lg"
              disabled={flow.importing}
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => flow.setDuplicates(option.id)}
              className="font-normal"
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** الخطوة 2: ربط كل عمود في الملف بحقل في البرنامج ثم الاستيراد. */
export function ImportMapStep({
  flow,
  sheet,
}: {
  flow: ImportFlow;
  sheet: ParsedSheet;
}) {
  const { importing, progress } = flow;

  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle>اربط أعمدة الملف بحقول البرنامج</DialogTitle>
        <DialogDescription>
          ربطنا ما أمكن تلقائياً. راجع الاختيارات وعدّل ما تريد.
        </DialogDescription>
      </DialogHeader>
      <ImportSteps current="map" />

      <FileSummary
        fileName={flow.fileName}
        sheet={sheet}
        disabled={importing}
        onChange={flow.backToFile}
      />
      <CoverageSummary coverage={flow.coverage} />

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
        {sheet.columns.map((column) => (
          <ColumnRow
            key={column}
            column={column}
            sample={sheet.rows[0]?.[column]}
            value={flow.mapping[column] ?? IGNORE}
            disabled={importing}
            onChange={(value) => flow.assign(column, value)}
          />
        ))}
      </ul>

      <DuplicateModePicker flow={flow} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={importing}
          onClick={flow.backToFile}
          className="font-normal sm:me-auto"
        >
          رجوع
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!flow.canImport}
          onClick={() => void flow.runImport()}
          className="gap-2 px-5"
        >
          {importing ? (
            <>
              <SavingLabel text="جارٍ الاستيراد…" />{" "}
              <Num className="tabular-nums">
                {progress.done}/{progress.total}
              </Num>
            </>
          ) : (
            <>
              استيراد <Num>{sheet.rows.length}</Num> صنف
            </>
          )}
        </Button>
      </div>
    </>
  );
}
