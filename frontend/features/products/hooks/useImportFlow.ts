import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  autoMapColumns,
  type ColumnMapping,
  type MappingValue,
} from "../config/importFields";
import {
  SHEET_PATTERN,
  type DuplicateMode,
  type ImportStep,
} from "../config/importOptions";
import { productKeys } from "../config/productQueryKeys";
import { readSheet, type ParsedSheet } from "../lib/excelSheet";
import { assignColumn, mappingCoverage } from "../lib/importMapping";
import { importProducts, type ImportReport } from "../lib/productImport";

/** حالة معالج الاستيراد كاملة: الملف ← ربط الأعمدة ← التقرير. */
export function useImportFlow() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>("file");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [duplicates, setDuplicates] = useState<DuplicateMode>("update");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<ImportReport | null>(null);

  async function acceptFile(file: File | undefined) {
    if (!file || reading) return;
    if (!SHEET_PATTERN.test(file.name)) {
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
