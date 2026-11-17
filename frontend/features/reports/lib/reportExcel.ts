import { currencySymbol } from "@/lib/currency";
import { normalizeDigits } from "@/lib/format";
import { saveFile, type SavedFile } from "@/lib/saveFile";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** حد Excel لاسم الورقة. */
const MAX_SHEET_NAME = 31;
const FORBIDDEN_SHEET_CHARS = /[\\/?*[\]:]/g;

/**
 * نص خلية كما يظهر ← رقم لو كان مبلغاً/كمية/نسبة فقط («1,250.50 ج.م» ← 1250.5).
 * النص الذي فيه كلمات (اسم صنف فيه رقم مثلاً) يبقى نصاً.
 */
function toCellValue(text: string): string | number {
  const clean = text.replace(/\s+/g, " ").trim();
  const numeric = normalizeDigits(clean)
    .replace(currencySymbol(), "")
    .replace(/[%\s,]/g, "")
    .replace("−", "-");
  // صفر في البداية = تليفون أو كود (01011110002)، يبقى نصاً حتى لا يضيع الصفر.
  if (/^0\d/.test(numeric)) return clean;
  return /^-?\d+(\.\d+)?$/.test(numeric) ? Number(numeric) : clean;
}

function uniqueName(name: string, used: Set<string>): string {
  const base =
    name.replace(FORBIDDEN_SHEET_CHARS, " ").trim().slice(0, MAX_SHEET_NAME) ||
    "تقرير";
  let candidate = base;
  for (let i = 2; used.has(candidate); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, MAX_SHEET_NAME - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

/** عنوان الجدول: أقرب عنوان في لوحته (h2 في ReportPanel). */
function tableTitle(table: HTMLTableElement): string {
  const section = table.closest("section");
  return section?.querySelector("h2")?.textContent?.trim() ?? "";
}

function tableRows(table: HTMLTableElement): (string | number)[][] {
  return Array.from(table.rows).map((row) =>
    Array.from(row.cells).map((cell) => toCellValue(cell.textContent ?? "")),
  );
}

/**
 * يصدّر كل جداول التقرير الظاهر الآن: كل جدول في ورقة باسم عنوانه.
 * يعتمد على الجداول المعروضة نفسها، فأي تبويب جديد يُصدَّر تلقائياً بدون كود إضافي.
 */
export async function exportReportTables(
  container: HTMLElement,
  title: string,
  periodLabel: string,
): Promise<{ file: SavedFile; sheets: number } | null> {
  const tables = Array.from(container.querySelectorAll("table"));
  if (tables.length === 0) return null;

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const table of tables) {
    const rows = tableRows(table);
    if (rows.length <= 1) continue; // رأس الجدول فقط
    const name = tableTitle(table) || title;
    const sheet = XLSX.utils.aoa_to_sheet([[name], [periodLabel], [], ...rows]);
    const widths = rows[0].map((_, col) =>
      Math.min(
        40,
        Math.max(10, ...rows.map((r) => String(r[col] ?? "").length + 2)),
      ),
    );
    sheet["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, uniqueName(name, used));
  }
  if (workbook.SheetNames.length === 0) return null;
  workbook.Workbook = { Views: [{ RTL: true }] };
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as
    ArrayBuffer | Uint8Array;
  const date = new Date().toISOString().slice(0, 10);
  const file = await saveFile(
    new Uint8Array(bytes),
    `تقرير ${title} ${date}.xlsx`.replace(FORBIDDEN_SHEET_CHARS, "-"),
    XLSX_MIME,
  );
  return { file, sheets: workbook.SheetNames.length };
}
