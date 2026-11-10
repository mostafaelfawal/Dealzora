import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  autoMapColumns,
  type ColumnMapping,
  type MappingValue,
} from "../config/importFields";
import type { DuplicateMode, ImportStep } from "../config/importOptions";
import { productKeys } from "../config/productQueryKeys";
import type { ParsedSheet } from "../lib/excelSheet";
import { loadImportFile, type LoadedSheet } from "../lib/importFile";
import { assignColumn, mappingCoverage } from "../lib/importMapping";
import { importProducts, type ImportReport } from "../lib/productImport";

/**
 * حالة معالج الاستيراد كاملة: الملف ← ربط الأعمدة ← التقرير.
 * initial: ملف مقروء مسبقاً (إفلات على صفحة المنتجات) فيبدأ من خطوة ربط الأعمدة مباشرة.
 */
export function useImportFlow(initial?: LoadedSheet | null) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>(initial ? "map" : "file");
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(
    initial?.sheet ?? null,
  );
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    initial ? autoMapColumns(initial.sheet.columns) : {},
  );
  const [duplicates, setDuplicates] = useState<DuplicateMode>("update");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<ImportReport | null>(null);

  async function acceptFile(file: File | undefined) {
    if (!file || reading) return;
    setReading(true);
    try {
      const loaded = await loadImportFile(file);
      if (!loaded) return;
      setFileName(loaded.fileName);
      setSheet(loaded.sheet);
      setMapping(autoMapColumns(loaded.sheet.columns));
      setStep("map");
    } finally {
      setReading(false);
    }
  }

  function assign(column: string, value: MappingValue) {
    setMapping((prev) => assignColumn(prev, column, value));
  }

  const coverage = mappingCoverage(mapping);
  const canImport = coverage.missingRequired.length === 0 && !importing;

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

  return {
    step,
    backToFile: () => setStep("file"),
    fileName,
    sheet,
    mapping,
    assign,
    coverage,
    duplicates,
    setDuplicates,
    reading,
    importing,
    progress,
    report,
    canImport,
    acceptFile,
    runImport,
  };
}

export type ImportFlow = ReturnType<typeof useImportFlow>;
