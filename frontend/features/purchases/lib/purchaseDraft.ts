import { normalizeSearch, round2 } from "@/features/pos/lib/posCalc";
import type { Product } from "@/features/products/types/product";
import { moneyInputOrZero, parseNumberInput } from "@/lib/format";

import { PURCHASE_SEARCH_LIMIT } from "../config/purchaseOptions";
import type { PurchaseDraftLine, PurchaseInput } from "../types/purchase";

/** منطق مسودة فاتورة الشراء: دوال نقية بلا React. */

export const lineValue = (l: PurchaseDraftLine) =>
  round2(moneyInputOrZero(l.qty) * moneyInputOrZero(l.cost));

/** بحث بالباركود (كامل أو جزئي) أو بكل كلمات الاسم. */
export function searchProducts(products: Product[], term: string) {
  const q = normalizeSearch(term);
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const isDigits = /^\d+$/.test(q);
  return products
    .filter(
      (p) =>
        p.barcode === q ||
        (isDigits && p.barcode.includes(q)) ||
        tokens.every((t) => normalizeSearch(p.name).includes(t)),
    )
    .slice(0, PURCHASE_SEARCH_LIMIT);
}

function newDraftLine(p: Product): PurchaseDraftLine {
  return {
    key: `${p.id}-${Date.now()}`,
    productId: p.id,
    name: p.name,
    unit: p.unit,
    allowDecimal: p.allowDecimal,
    currentCost: p.costPrice ?? 0,
    currentPrice: p.salePrice,
    qty: "1",
    cost: String(p.costPrice ?? 0),
    salePrice: "",
  };
}

/** الصنف الموجود تزيد كميته 1، والجديد يُضاف بسطر جديد. */
export function addProductLine(
  lines: PurchaseDraftLine[],
  p: Product,
): PurchaseDraftLine[] {
  if (!lines.some((l) => l.productId === p.id)) {
    return [...lines, newDraftLine(p)];
  }
  return lines.map((l) =>
    l.productId === p.id
      ? { ...l, qty: String(round2(moneyInputOrZero(l.qty) + 1)) }
      : l,
  );
}

/** سبب رفض السطر، أو null لو سليم. */
export function lineError(l: PurchaseDraftLine): string | null {
  const qty = parseNumberInput(l.qty);
  const cost = parseNumberInput(l.cost);
  if (!(qty > 0)) return "الكمية";
  if (!l.allowDecimal && !Number.isInteger(qty)) return "الكمية لا تقبل كسوراً";
  if (!(cost >= 0)) return "سعر الشراء";
  if (l.salePrice.trim() && !(parseNumberInput(l.salePrice) > 0))
    return "سعر البيع";
  return null;
}

export interface DraftTotals {
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
}

export function draftTotals(
  lines: PurchaseDraftLine[],
  discountInput: string,
  paidInput: string,
): DraftTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + lineValue(l), 0));
  const discount = Math.min(moneyInputOrZero(discountInput), subtotal);
  const total = round2(subtotal - discount);
  const paid = moneyInputOrZero(paidInput);
  return { subtotal, discount, total, paid, remaining: round2(total - paid) };
}

export function draftErrors({
  supplierId,
  lines,
  lineErrors,
  totals,
}: {
  supplierId: string;
  lines: PurchaseDraftLine[];
  lineErrors: (string | null)[];
  totals: DraftTotals;
}): string[] {
  return [
    !supplierId && "اختر المورد",
    lines.length === 0 && "أضف صنفاً واحداً على الأقل",
    lineErrors.some(Boolean) && "راجع الكميات والأسعار في الأصناف المظللة",
    totals.paid > totals.total && "المدفوع أكبر من إجمالي الفاتورة",
  ].filter((e): e is string => Boolean(e));
}

export function toPurchaseInput(draft: {
  supplierId: string;
  supplierInvoice: string;
  date: string;
  note: string;
  lines: PurchaseDraftLine[];
  totals: DraftTotals;
}): PurchaseInput {
  return {
    supplierId: draft.supplierId,
    supplierInvoice: draft.supplierInvoice,
    purchasedOn: draft.date,
    discount: draft.totals.discount,
    paidAmount: draft.totals.paid,
    note: draft.note,
    lines: draft.lines.map((l) => ({
      productId: l.productId,
      qty: moneyInputOrZero(l.qty),
      unitCost: moneyInputOrZero(l.cost),
      newSalePrice: l.salePrice.trim() ? moneyInputOrZero(l.salePrice) : null,
    })),
  };
}
