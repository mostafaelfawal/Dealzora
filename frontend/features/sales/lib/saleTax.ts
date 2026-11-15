import { formatRate } from "@/lib/tax";

import type { Sale } from "../types/sale";

export interface TaxRow {
  label: string;
  amount: number;
}

/**
 * سطور الضريبة في الإيصال (المطبوع والمعاينة وواتساب)، مجمّعة حسب النسبة من ضريبة السطور
 * المخزّنة (فمجموعها = ضريبة الفاتورة بالقرش). فارغة لفاتورة بلا ضريبة أو قبل إضافتها،
 * فيبقى الإيصال كما كان تماماً لمحل لم يفعّل الضريبة.
 *   - شاملة:     «منها ضريبة القيمة المضافة 14%»
 *   - غير شاملة: «الإجمالي قبل الضريبة» ثم «ضريبة القيمة المضافة 14%»
 */
export function saleTaxRows(sale: Sale): TaxRow[] {
  if (!sale.taxMode || sale.taxMode === "off" || !sale.taxTotal) return [];
  const byRate = new Map<number, number>();
  for (const l of sale.lines) {
    if (l.taxRate && l.taxAmount)
      byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + l.taxAmount);
  }
  const prefix =
    sale.taxMode === "inclusive"
      ? "منها ضريبة القيمة المضافة"
      : "ضريبة القيمة المضافة";
  const rows: TaxRow[] = [...byRate]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, amount]) => ({
      label: `${prefix} ${formatRate(rate)}`,
      amount: Math.round(amount * 100) / 100,
    }));
  if (sale.taxMode === "exclusive" && sale.taxableTotal !== null)
    rows.unshift({ label: "الإجمالي قبل الضريبة", amount: sale.taxableTotal });
  return rows;
}
