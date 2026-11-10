import { round2, round3 } from "@/features/pos/lib/posCalc";

import type { Sale, SaleLine } from "../types/sale";

/** كمية مرتجع لكل سطر (saleLineId ← كمية). */
export type SaleReturnQtys = Record<string, number>;

export const returnableQty = (line: SaleLine) =>
  round3(line.qty - line.returnedQty);

/** يقيّد الكمية بين 0 والمتاح للإرجاع، بثلاث خانات عشرية. */
export const clampReturnQty = (value: number, max: number) =>
  Math.min(Math.max(round3(value), 0), max);

/**
 * الأسطر المختارة وقيمتها التقريبية بالسعر المدفوع فعلاً (بعد الخصم).
 * القيمة النهائية يحسبها السيرفر.
 */
export function saleReturnSelection(sale: Sale, qtys: SaleReturnQtys) {
  const chosen = sale.lines.filter((l) => (qtys[l.id] ?? 0) > 0);
  const estimate = round2(
    chosen.reduce((sum, l) => sum + (l.netTotal / l.qty) * qtys[l.id], 0),
  );
  return {
    chosen,
    estimate,
    lines: chosen.map((l) => ({ saleLineId: l.id, qty: qtys[l.id] })),
  };
}
