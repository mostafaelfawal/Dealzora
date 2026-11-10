import { round2, round3 } from "@/features/pos/lib/posCalc";

import type { Purchase, PurchaseLine } from "../types/purchase";

export const returnableQty = (l: PurchaseLine) => round3(l.qty - l.returnedQty);

/** كميات مكتوبة كنص لكل سطر (lineId ← نص). */
export type ReturnQtys = Record<string, string>;

export const parseQty = (value: string | undefined) => Number(value) || 0;

/** الأسطر المختارة للإرجاع وصلاحيتها وقيمتها التقريبية. */
export function returnSelection(purchase: Purchase, qtys: ReturnQtys) {
  const chosen = purchase.lines
    .map((line) => ({ line, qty: round3(parseQty(qtys[line.id])) }))
    .filter((x) => x.qty > 0);

  const invalid = chosen.some((x) => x.qty > returnableQty(x.line));

  // الخصم على الفاتورة يُوزَّع نسبياً على الأسطر المرتجعة.
  const discountRatio =
    purchase.subtotal > 0 ? purchase.total / purchase.subtotal : 1;
  const estimate = round2(
    chosen.reduce((s, x) => s + (x.line.lineTotal / x.line.qty) * x.qty, 0) *
      discountRatio,
  );

  return {
    chosen,
    invalid,
    estimate,
    canSubmit: chosen.length > 0 && !invalid,
    lines: chosen.map((x) => ({ lineId: x.line.id, qty: x.qty })),
  };
}
