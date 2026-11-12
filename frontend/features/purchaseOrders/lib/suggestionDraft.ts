import { round2 } from "@/features/pos/lib/posCalc";
import { formatQty, parseNumberInput } from "@/lib/format";

import { NO_SUPPLIER } from "../config/purchaseOrderOptions";
import type {
  OrderInput,
  Suggestion,
  SuggestionDraft,
  Urgency,
} from "../types/purchaseOrder";

/** منطق شاشة الاقتراح: دوال نقية بلا React. */

export type Drafts = Record<string, SuggestionDraft>;

const freshDraft = (s: Suggestion): SuggestionDraft => ({
  selected: s.suggestedQty > 0,
  qty: s.suggestedQty > 0 ? String(s.suggestedQty) : "",
  supplierId: s.supplierId ?? NO_SUPPLIER,
});

/**
 * يبني اختيارات المستخدم للأصناف الحالية. التعديلات السابقة تبقى
 * (تحديث لحظي بعد بيع لا يمسح ما كتبه)، إلا لو reset (تغيّرت الإعدادات).
 */
export function mergeDrafts(
  items: Suggestion[],
  prev: Drafts,
  reset = false,
): Drafts {
  const next: Drafts = {};
  for (const s of items)
    next[s.productId] = (!reset && prev[s.productId]) || freshDraft(s);
  return next;
}

export function draftQty(d: SuggestionDraft | undefined): number {
  const qty = parseNumberInput(d?.qty ?? "");
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

/** سبب رفض الكمية، أو null. */
export function qtyError(s: Suggestion, d: SuggestionDraft): string | null {
  if (!d.selected) return null;
  const qty = parseNumberInput(d.qty);
  if (!(qty > 0)) return "الكمية";
  if (!s.allowDecimal && !Number.isInteger(qty)) return "بدون كسور";
  return null;
}

export const lineValue = (s: Suggestion, d: SuggestionDraft | undefined) =>
  round2(draftQty(d) * s.unitCost);

/** «= 3 كرتونة» أو «= 2 كرتونة + 4» للعرض بجانب الكمية. */
export function packHint(s: Suggestion, qty: number): string | null {
  if (!s.packName || !s.packSize || qty < s.packSize) return null;
  const packs = Math.floor(qty / s.packSize);
  const rest = round2(qty - packs * s.packSize);
  return `= ${packs} ${s.packName}${rest > 0 ? ` + ${rest}` : ""}`;
}

export interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  items: Suggestion[];
  selected: number;
  total: number;
  hasErrors: boolean;
}

/** يجمع الأصناف حسب المورد المختار. «بدون مورد» في الآخر، والأكثر استعجالاً أولاً. */
export function groupBySupplier(
  items: Suggestion[],
  drafts: Drafts,
  supplierNames: Map<string, string>,
): SupplierGroup[] {
  const map = new Map<string, SupplierGroup>();
  for (const s of items) {
    const d = drafts[s.productId];
    const id = d?.supplierId ?? NO_SUPPLIER;
    let g = map.get(id);
    if (!g) {
      g = {
        supplierId: id,
        supplierName:
          id === NO_SUPPLIER
            ? "بدون مورد سابق"
            : (supplierNames.get(id) ?? s.supplierName ?? "مورد"),
        items: [],
        selected: 0,
        total: 0,
        hasErrors: false,
      };
      map.set(id, g);
    }
    g.items.push(s);
    if (d?.selected) {
      g.selected += 1;
      g.total = round2(g.total + lineValue(s, d));
      if (qtyError(s, d)) g.hasErrors = true;
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.supplierId === NO_SUPPLIER) return 1;
    if (b.supplierId === NO_SUPPLIER) return -1;
    return b.selected - a.selected || b.total - a.total;
  });
}

export function toOrderInput(g: SupplierGroup, drafts: Drafts): OrderInput {
  return {
    supplierId: g.supplierId,
    note: "",
    lines: g.items
      .filter((s) => drafts[s.productId]?.selected)
      .map((s) => ({
        productId: s.productId,
        qty: draftQty(drafts[s.productId]),
        unitCost: s.unitCost,
      })),
  };
}

export const canOrder = (g: SupplierGroup) =>
  g.supplierId !== NO_SUPPLIER && g.selected > 0 && !g.hasErrors;

export function filterByUrgency(
  items: Suggestion[],
  urgency: Urgency | "all",
): Suggestion[] {
  return urgency === "all" ? items : items.filter((s) => s.urgency === urgency);
}

/** «يكفي 2.5 يوم» / «لا مبيعات» للعرض. */
export function daysLeftLabel(s: Suggestion): string {
  if (s.stock <= 0) return "نفد";
  if (s.daysLeft === null) return "لا مبيعات";
  if (s.daysLeft < 1) return "أقل من يوم";
  return `يكفي ${formatQty(round2(s.daysLeft))} يوم`;
}
