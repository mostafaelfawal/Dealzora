export interface ParsedSheet {
  columns: string[];
  rows: Record<string, string>[];
}

/** يقرأ أول ورقة: الصف الأول = أسماء الأعمدة. */
export async function readSheet(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const [header = [], ...body] = raw;
  const seen = new Map<string, number>();
  const columns = header.map((cell, i) => {
    const base = String(cell).trim() || `عمود ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count > 1 ? `${base} (${count})` : base;
  });

  const rows = body
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) =>
      Object.fromEntries(
        columns.map((column, i) => [column, String(row[i] ?? "").trim()]),
      ),
    );

  return { columns, rows };
}
