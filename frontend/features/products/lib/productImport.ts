import { getUnits } from "@/features/catalog/api/catalog.api";
import { extractErrorMessage } from "@/lib/errors";
import { normalizeDigits } from "@/lib/format";

import {
  createProduct,
  getCategories,
  getProducts,
  updateProduct,
} from "../api/products.api";
import {
  IGNORE,
  type ColumnMapping,
  type ImportFieldKey,
} from "../config/importFields";
import {
  BACKEND_DECIMAL_UNITS,
  BARCODE_PATTERN,
} from "../config/productLimits";
import type { Product } from "../types/product";
import { numberOrZero, parseNumber } from "./productCalc";
import { MONEY_SCALE, QTY_SCALE } from "./productMapper";

export interface ImportReport {
  created: number;
  updated: number;
  skipped: number;
  failed: { row: number; message: string }[];
}

/**
 * يستورد الصفوف صنفاً صنفاً عبر نفس endpoints الإضافة والتعديل.
 * الباركود الموجود مسبقاً: تحديث أو تخطٍّ حسب اختيار المستخدم.
 */
export async function importProducts({
  rows,
  mapping,
  duplicates,
  onProgress,
}: {
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  duplicates: "update" | "skip";
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportReport> {
  const cols: Partial<Record<ImportFieldKey, string>> = {};
  for (const [column, key] of Object.entries(mapping)) {
    if (key !== IGNORE) cols[key as ImportFieldKey] = column;
  }

  const [categories, units] = await Promise.all([getCategories(), getUnits()]);
  // الوحدات الموزونة حسب إعداد المدير في قائمة الوحدات.
  const decimalUnits = new Set(
    units.filter((u) => u.allowDecimal).map((u) => u.name),
  );
  const categoryByName = new Map(
    categories.map((c) => [c.label.trim().toLowerCase(), c.id]),
  );
  const report: ImportReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const text = (key: ImportFieldKey) => {
      const column = cols[key];
      return column ? (row[column] ?? "").trim() : "";
    };
    const num = (key: ImportFieldKey) => numberOrZero(parseNumber(text(key)));

    try {
      const name = text("name").split(/\s+/).filter(Boolean).join(" ");
      if (!name) throw new Error("اسم الصنف فارغ");

      const sale = parseNumber(text("salePrice"));
      if (!(sale > 0)) throw new Error("سعر البيع غير صالح");

      const barcode = normalizeDigits(text("barcode")).trim();
      if (barcode && !BARCODE_PATTERN.test(barcode))
        throw new Error("الباركود غير صالح");

      let existing: Product | undefined;
      if (barcode) {
        const page = await getProducts({ q: barcode, page: 1, page_size: 20 });
        existing = page.items.find((p) => p.barcode === barcode);
      }
      if (existing && duplicates === "skip") {
        report.skipped++;
        continue;
      }

      const unit = text("unit") || existing?.unit || "قطعة";
      const decimal =
        existing?.allowDecimal ||
        BACKEND_DECIMAL_UNITS.has(unit) ||
        decimalUnits.has(unit);
      const qty = (value: number) =>
        Math.max(
          0,
          Math.round((decimal ? value : Math.round(value)) * QTY_SCALE),
        );
      const categoryText = text("category").toLowerCase();
      const pluText = normalizeDigits(text("scaleCode")).trim();
      const scaleCode = /^\d{1,6}$/.test(pluText) ? Number(pluText) : 0;

      const base = {
        name,
        barcode: barcode || null,
        category_id:
          (categoryText && categoryByName.get(categoryText)) ||
          existing?.category ||
          null,
        unit,
        allow_decimal: decimal,
        cost_price: text("costPrice")
          ? Math.max(0, Math.round(num("costPrice") * MONEY_SCALE))
          : existing?.costPrice != null
            ? Math.round(existing.costPrice * MONEY_SCALE)
            : 0,
        sale_price: Math.round(sale * MONEY_SCALE),
        min_stock: text("minStock")
          ? qty(num("minStock"))
          : existing
            ? Math.round(existing.minStock * QTY_SCALE)
            : 0,
        is_active: existing?.isActive ?? true,
        // كود الميزان للموزون فقط. عمود فارغ/غير مربوط = نُبقي الحالي.
        scale_code: !decimal
          ? null
          : scaleCode > 0
            ? scaleCode
            : (existing?.scaleCode ?? null),
      };

      if (existing) {
        await updateProduct(existing.id, {
          ...base,
          extra_units: existing.extraUnits.map((u) => ({
            id: u.id,
            name: u.name,
            factor: Math.round(u.factor * QTY_SCALE),
            barcode: u.barcode || null,
            sale_price:
              u.salePrice === null
                ? null
                : Math.round(u.salePrice * MONEY_SCALE),
          })),
          base_version: existing.version,
        });
        report.updated++;
      } else {
        await createProduct({
          ...base,
          extra_units: [],
          opening_stock: qty(num("stock")),
        });
        report.created++;
      }
    } catch (error) {
      report.failed.push({
        row: i + 2, // +1 للترويسة، +1 لأن الصفوف تبدأ من 1
        message: extractErrorMessage(error, "تعذّر استيراد الصف"),
      });
    } finally {
      onProgress?.(i + 1, rows.length);
    }
  }

  return report;
}
