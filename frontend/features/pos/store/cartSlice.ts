import {
  createSlice,
  current,
  Draft,
  isDraft,
  type PayloadAction,
} from "@reduxjs/toolkit";

import { clampQty, lineKey, unitOptions } from "../lib/posCalc";
import type {
  CartLine,
  HeldInvoice,
  InvoiceDiscount,
  PosCustomer,
  PosInvoice,
  PosProduct,
} from "../types/pos";

/** أقصى عدد من خطوات التراجع المحفوظة. */
const HISTORY_LIMIT = 50;
/** رقم مبدئي للعرض فقط؛ الرقم الحقيقي يأتي من الـ backend عند تحميل الكاشير والحفظ. */
const FIRST_INVOICE_NUMBER = 1;

const EMPTY_INVOICE: PosInvoice = { lines: [], customer: null, discount: null };

export interface RemovedLine {
  line: CartLine;
  index: number;
}

/** اللي بيتحفظ في localStorage. */
export interface PersistedCart {
  invoice: PosInvoice;
  held: HeldInvoice[];
  nextNumber: number;
}

/**
 * الفاتورة الحالية محفوظة كسجل (past / present / future) للتراجع والإعادة.
 * التراجع يشمل تعديلات الفاتورة الحالية فقط (إضافة، كمية، حذف، عميل، خصم).
 * التعليق والاسترجاع والإلغاء والدفع تبدأ سجلاً جديداً.
 */
export interface CartState {
  past: PosInvoice[];
  present: PosInvoice;
  future: PosInvoice[];
  held: HeldInvoice[];
  nextNumber: number;
  /** الاختيار الخام. للقيمة الفعلية استخدم selectSelectedId. */
  selectedId: string | null;
  lastRemoved: RemovedLine | null;
  hydrated: boolean;
}

const initialState: CartState = {
  past: [],
  present: EMPTY_INVOICE,
  future: [],
  held: [],
  nextNumber: FIRST_INVOICE_NUMBER,
  selectedId: null,
  lastRemoved: null,
  hydrated: false,
};

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** نسخة عادية (مش Draft) من قيمة جوه الـ state. */
function plain<T>(value: T): T {
  return isDraft(value) ? (current(value as Draft<T>) as T) : value;
}

/** المحدد الفعلي: لو الاختيار الخام مش موجود في الفاتورة نرجع آخر صنف. */
export function resolveSelectedId(
  lines: CartLine[],
  raw: string | null,
): string | null {
  if (lines.some((l) => lineKey(l) === raw)) return raw;
  const last = lines.at(-1);
  return last ? lineKey(last) : null;
}

/** سطر جديد بوحدة معيّنة (null = الأساسية). الوحدات الإضافية بالعدد الصحيح دائماً. */
function toLine(
  product: PosProduct,
  qty: number,
  unitId: string | null = null,
): CartLine {
  const extra = unitId
    ? (unitOptions(product).find((u) => u.id === unitId) ?? null)
    : null;
  const allowDecimal = extra ? false : product.allowDecimal;
  return {
    productId: product.id,
    unitId: extra ? extra.id : null,
    factor: extra ? extra.factor : 1,
    name: product.name,
    barcode: product.barcode,
    unit: extra ? extra.name : product.unit,
    price: extra ? extra.price : product.price,
    qty: clampQty(qty, allowDecimal),
    allowDecimal,
    stock: product.stock,
  };
}

const keyOf = (line: CartLine) => lineKey(line);

/** تعديل قابل للتراجع. لو `update` رجّعت نفس المرجع يبقى مفيش تغيير ومش بيتسجّل. */
function commit(state: CartState, update: (prev: PosInvoice) => PosInvoice) {
  const prev = plain(state.present);
  const next = update(prev);
  if (next === prev) return;
  state.past.push(prev);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.present = next;
  state.future = [];
}

/** استبدال الفاتورة وبدء سجل جديد. */
function resetTo(state: CartState, invoice: PosInvoice) {
  state.past = [];
  state.present = invoice;
  state.future = [];
  const last = invoice.lines.at(-1);
  state.selectedId = last ? keyOf(last) : null;
}

function applyQty(state: CartState, id: string, qty: number) {
  commit(state, (prev) => {
    const target = prev.lines.find((l) => keyOf(l) === id);
    if (!target) return prev;
    const next = clampQty(qty, target.allowDecimal);
    if (next === target.qty) return prev;
    return {
      ...prev,
      lines: prev.lines.map((l) => (keyOf(l) === id ? { ...l, qty: next } : l)),
    };
  });
  state.selectedId = id;
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    /** تحميل المحفوظ من المتصفح. بيحصل مرة واحدة بس. */
    hydrate(state, action: PayloadAction<Partial<PersistedCart>>) {
      if (state.hydrated) return;
      const { invoice, held, nextNumber } = action.payload;
      if (invoice && Array.isArray(invoice.lines)) resetTo(state, invoice);
      if (Array.isArray(held)) state.held = held;
      if (typeof nextNumber === "number") state.nextNumber = nextNumber;
      state.hydrated = true;
    },

    /* ---------- الأصناف ---------- */

    addProduct(
      state,
      action: PayloadAction<{
        product: PosProduct;
        qty?: number;
        /** وحدة إضافية (مسح باركود الكرتونة). الغياب = الأساسية. */
        unitId?: string | null;
      }>,
    ) {
      const { product, qty = 1, unitId = null } = action.payload;
      const line = toLine(product, qty, unitId);
      const key = keyOf(line);
      commit(state, (prev) => {
        const exists = prev.lines.some((l) => keyOf(l) === key);
        const lines = exists
          ? prev.lines.map((l) =>
              keyOf(l) === key
                ? { ...l, qty: clampQty(l.qty + qty, l.allowDecimal) }
                : l,
            )
          : [...prev.lines, line];
        return { ...prev, lines };
      });
      state.selectedId = key;
    },

    /**
     * تغيير وحدة بيع السطر (قطعة <-> كرتونة). السعر يتبع الوحدة الجديدة وخصم السطر يُلغى.
     * لو الصنف موجود بالفعل بالوحدة الجديدة، يندمج السطران.
     */
    setLineUnit(
      state,
      action: PayloadAction<{
        id: string;
        product: PosProduct;
        unitId: string | null;
      }>,
    ) {
      const { id, product, unitId } = action.payload;
      let selected = id;
      commit(state, (prev) => {
        const index = prev.lines.findIndex((l) => keyOf(l) === id);
        if (index < 0) return prev;
        const old = prev.lines[index];
        if ((old.unitId ?? null) === unitId) return prev;
        const next = toLine(product, old.qty, unitId);
        const key = keyOf(next);
        selected = key;
        const twin = prev.lines.some((l) => keyOf(l) === key);
        if (twin) {
          return {
            ...prev,
            lines: prev.lines
              .filter((l) => keyOf(l) !== id)
              .map((l) =>
                keyOf(l) === key
                  ? { ...l, qty: clampQty(l.qty + next.qty, l.allowDecimal) }
                  : l,
              ),
          };
        }
        const lines = [...prev.lines];
        lines[index] = next;
        return { ...prev, lines };
      });
      state.selectedId = selected;
    },

    setQty(state, action: PayloadAction<{ id: string; qty: number }>) {
      applyQty(state, action.payload.id, action.payload.qty);
    },

    /** +/- : القطعة بخطوة 1، والوزن بخطوة 0.5. لا ينزل تحت الحد الأدنى. */
    changeQty(state, action: PayloadAction<{ id: string; direction: 1 | -1 }>) {
      const { id, direction } = action.payload;
      const line = state.present.lines.find((l) => keyOf(l) === id);
      if (!line) return;
      const step = line.allowDecimal ? 0.5 : 1;
      const next = line.qty + direction * step;
      if (next < (line.allowDecimal ? 0.5 : 1)) return;
      applyQty(state, id, next);
    },

    removeLine(state, action: PayloadAction<string>) {
      const id = action.payload;
      const prev = plain(state.present);
      const index = prev.lines.findIndex((l) => keyOf(l) === id);
      if (index < 0) return;
      const rest = prev.lines.filter((l) => keyOf(l) !== id);
      state.lastRemoved = { line: prev.lines[index], index };
      commit(state, (p) => ({ ...p, lines: rest }));
      const next = rest[Math.min(index, rest.length - 1)];
      state.selectedId = next ? keyOf(next) : null;
    },

    /** زر «تراجع» في إشعار الحذف: يعيد الصنف المحذوف في مكانه. */
    undoRemove(state) {
      const removed = state.lastRemoved ? plain(state.lastRemoved) : null;
      if (!removed) return;
      state.lastRemoved = null;
      commit(state, (prev) => {
        if (prev.lines.some((l) => keyOf(l) === keyOf(removed.line)))
          return prev;
        const lines = [...prev.lines];
        lines.splice(Math.min(removed.index, lines.length), 0, removed.line);
        return { ...prev, lines };
      });
      state.selectedId = keyOf(removed.line);
    },

    selectLine(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },

    moveSelection(state, action: PayloadAction<1 | -1>) {
      const ids = state.present.lines.map(keyOf);
      if (ids.length === 0) return;
      const selected = resolveSelectedId(
        plain(state.present).lines,
        state.selectedId,
      );
      const idx = selected ? ids.indexOf(selected) : -1;
      const next =
        idx === -1
          ? action.payload === 1
            ? 0
            : ids.length - 1
          : Math.min(Math.max(idx + action.payload, 0), ids.length - 1);
      state.selectedId = ids[next];
    },

    /** خصم مبلغ ثابت على سطر (0 = إزالة). */
    setLineDiscount(
      state,
      action: PayloadAction<{ id: string; amount: number }>,
    ) {
      const { id, amount } = action.payload;
      commit(state, (prev) => {
        const target = prev.lines.find((l) => keyOf(l) === id);
        if (!target || (target.discount ?? 0) === amount) return prev;
        return {
          ...prev,
          lines: prev.lines.map((l) =>
            keyOf(l) === id ? { ...l, discount: amount } : l,
          ),
        };
      });
      state.selectedId = id;
    },

    /* ---------- بيانات الفاتورة ---------- */

    setCustomer(state, action: PayloadAction<PosCustomer | null>) {
      const customer = action.payload;
      commit(state, (prev) =>
        (prev.customer?.id ?? null) === (customer?.id ?? null)
          ? prev
          : { ...prev, customer },
      );
    },

    setDiscount(state, action: PayloadAction<InvoiceDiscount | null>) {
      const discount = action.payload;
      commit(state, (prev) => {
        if (prev.discount === null && discount === null) return prev;
        if (
          prev.discount &&
          discount &&
          prev.discount.type === discount.type &&
          prev.discount.value === discount.value
        )
          return prev;
        return { ...prev, discount };
      });
    },

    /* ---------- تعليق / استرجاع / إنهاء ---------- */

    holdInvoice: {
      reducer(state, action: PayloadAction<{ id: string; heldAt: number }>) {
        const invoice = plain(state.present);
        if (invoice.lines.length === 0) return;
        state.held.unshift({ ...action.payload, invoice });
        resetTo(state, EMPTY_INVOICE);
      },
      // الـ id والوقت بيتولّدوا هنا (مش جوه الـ reducer) عشان يفضل نقي.
      prepare: () => ({ payload: { id: newId(), heldAt: Date.now() } }),
    },

    /** لو الفاتورة الحالية فيها أصناف بتتعلّق تلقائياً بدل ما تتمسح. */
    recallHeld: {
      reducer(
        state,
        action: PayloadAction<{ id: string; swapId: string; at: number }>,
      ) {
        const { id, swapId, at } = action.payload;
        const held = plain(state.held);
        const target = held.find((h) => h.id === id);
        if (!target) return;
        const invoice = plain(state.present);
        const rest = held.filter((h) => h.id !== id);
        state.held =
          invoice.lines.length > 0
            ? [{ id: swapId, heldAt: at, invoice }, ...rest]
            : rest;
        resetTo(state, target.invoice);
      },
      prepare: (id: string) => ({
        payload: { id, swapId: newId(), at: Date.now() },
      }),
    },

    cancelInvoice(state) {
      resetTo(state, EMPTY_INVOICE);
    },

    /** يقفل الفاتورة بعد حفظها في الـ backend. savedNumber = الرقم الذي أعطاه السيرفر. */
    completeInvoice(state, action: PayloadAction<number | undefined>) {
      state.nextNumber = (action.payload ?? state.nextNumber) + 1;
      resetTo(state, EMPTY_INVOICE);
    },

    /** آخر رقم فاتورة في الـ backend + 1 (عند فتح الكاشير). */
    /**
     * الكتالوج اتحدث (المدير غيّر سعراً من جهاز آخر، أو كاشير آخر باع فتغيّر الرصيد):
     * نحدّث سعر ورصيد سطور الفاتورة المفتوحة ليطابق السيرفر. ليس تعديلاً من المستخدم فلا يدخل التراجع.
     * الصنف المحذوف/المعطّل أو الوحدة المحذوفة: يبقى السطر كما هو والسيرفر يرفضه برسالة واضحة.
     */
    applyCatalog(state, action: PayloadAction<PosProduct[]>) {
      const byId = new Map(action.payload.map((p) => [p.id, p]));
      for (const line of state.present.lines) {
        const product = byId.get(line.productId);
        if (!product) continue;
        const unit = unitOptions(product).find(
          (u) => u.id === (line.unitId ?? null),
        );
        if (!unit) continue;
        line.price = unit.price;
        line.stock = product.stock;
      }
    },

    syncNextNumber(state, action: PayloadAction<number>) {
      state.nextNumber = action.payload;
    },

    /* ---------- تراجع / إعادة ---------- */

    undo(state) {
      const { past, present, future } = current(state);
      if (past.length === 0) return;
      state.past = past.slice(0, -1);
      state.present = past[past.length - 1];
      state.future = [present, ...future];
    },

    redo(state) {
      const { past, present, future } = current(state);
      if (future.length === 0) return;
      state.past = [...past, present].slice(-HISTORY_LIMIT);
      state.present = future[0];
      state.future = future.slice(1);
    },
  },
});

export const cartActions = cartSlice.actions;
export default cartSlice.reducer;
