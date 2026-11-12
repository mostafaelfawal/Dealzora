import {
  createSlice,
  current,
  Draft,
  isDraft,
  type PayloadAction,
} from "@reduxjs/toolkit";

import { clampQty, lineKey, unitOptions } from "../lib/posCalc";
import { priceInvoice } from "../lib/pricing";
import type {
  CartLine,
  HeldInvoice,
  InvoiceDiscount,
  PosCustomer,
  PosInvoice,
  PosProduct,
  PosPromotion,
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

/** اللي بيتحفظ في localStorage: الفاتورة المفتوحة فقط (مسودة هذا الجهاز).
 *  المعلّقة على الجهاز الأساسي؛ held هنا للترحيل من النسخ القديمة فقط. */
export interface PersistedCart {
  invoice: PosInvoice;
  held?: HeldInvoice[];
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
  /** العروض السارية (من الكتالوج): السطور تُسعَّر بها تلقائياً. */
  promotions: PosPromotion[];
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
  promotions: [],
};

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
  const retail = extra ? extra.price : product.price;
  // الكرتونة بسعر خاص لا تأخذ جملة؛ المحسوبة من سعر القطعة تُحسب من سعر الجملة.
  const ownPrice = extra
    ? Boolean(product.units?.find((u) => u.id === extra.id)?.ownPrice)
    : false;
  const wholesale =
    product.wholesalePrice == null || ownPrice
      ? null
      : extra
        ? Math.round(product.wholesalePrice * extra.factor * 100) / 100
        : product.wholesalePrice;
  return {
    productId: product.id,
    unitId: extra ? extra.id : null,
    factor: extra ? extra.factor : 1,
    name: product.name,
    barcode: product.barcode,
    unit: extra ? extra.name : product.unit,
    price: retail,
    retailPrice: retail,
    wholesalePrice: wholesale,
    wholesaleMinQty: product.wholesaleMinQty ?? null,
    category: product.category,
    qty: clampQty(qty, allowDecimal),
    allowDecimal,
    stock: product.stock,
  };
}

const keyOf = (line: CartLine) => lineKey(line);

/** تعديل قابل للتراجع. لو `update` رجّعت نفس المرجع يبقى مفيش تغيير ومش بيتسجّل. */
function commit(state: CartState, update: (prev: PosInvoice) => PosInvoice) {
  const prev = plain(state.present);
  const updated = update(prev);
  if (updated === prev) return;
  // كل تعديل يعيد التسعير: الجملة تتبع العميل والكمية، والعروض تتبع الأصناف.
  const next = priceInvoice(updated, plain(state.promotions));
  state.past.push(prev);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.present = next;
  state.future = [];
}

/** استبدال الفاتورة وبدء سجل جديد. */
/** تسعير الفاتورة الحالية بدون تسجيلها في التراجع (عروض/كتالوج تغيّر). */
function reprice(state: CartState) {
  const prev = plain(state.present);
  const next = priceInvoice(prev, plain(state.promotions));
  if (next !== prev) state.present = next;
}

function resetTo(state: CartState, invoice: PosInvoice) {
  state.past = [];
  state.present = priceInvoice(invoice, plain(state.promotions));
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
      const { invoice, nextNumber } = action.payload;
      if (invoice && Array.isArray(invoice.lines)) resetTo(state, invoice);
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
      const prevId = state.present.customer?.id ?? null;
      if (prevId !== null && prevId === (customer?.id ?? null)) {
        // نفس العميل: نحدّث بياناته فقط (رصيد النقاط مثلاً) بدون خطوة تراجع.
        state.present.customer = customer;
        reprice(state);
        return;
      }
      commit(state, (prev) =>
        prevId === (customer?.id ?? null)
          ? prev
          : // نقاط العميل السابق لا تنتقل للجديد.
            { ...prev, customer, redeemPoints: 0 },
      );
    },

    /**
     * قائمة العملاء اتحدثت (نقاط كسبها من جهاز آخر، تحوّل لعميل جملة…):
     * العميل المختار في الفاتورة المفتوحة يأخذ أحدث بياناته. ليس تعديلاً من المستخدم.
     */
    applyCustomers(state, action: PayloadAction<PosCustomer[]>) {
      const current = state.present.customer;
      if (!current) return;
      const fresh = action.payload.find((c) => c.id === current.id);
      if (!fresh || JSON.stringify(fresh) === JSON.stringify(plain(current)))
        return;
      state.present.customer = fresh;
      reprice(state);
    },

    setRedeemPoints(state, action: PayloadAction<number>) {
      const points = Math.max(Math.floor(action.payload), 0);
      commit(state, (prev) =>
        (prev.redeemPoints ?? 0) === points
          ? prev
          : { ...prev, redeemPoints: points },
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

    /** السيرفر حفظ الفاتورة الحالية كمعلّقة: تُضاف للقائمة وتبدأ فاتورة جديدة. */
    holdInvoice(state, action: PayloadAction<HeldInvoice>) {
      state.held = [
        action.payload,
        ...state.held.filter((h) => h.id !== action.payload.id),
      ];
      resetTo(state, EMPTY_INVOICE);
    },

    /** السيرفر سلّم المعلّقة لهذا الجهاز (وحذفها من القائمة للجميع). */
    recallHeld(
      state,
      action: PayloadAction<{ id: string; invoice: PosInvoice }>,
    ) {
      state.held = state.held.filter((h) => h.id !== action.payload.id);
      resetTo(state, action.payload.invoice);
    },

    /** القائمة كما على الجهاز الأساسي (تعليقات الأجهزة الأخرى، وقفل الورديات). */
    setHeld(state, action: PayloadAction<HeldInvoice[]>) {
      state.held = action.payload;
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
        const fresh = toLine(product, line.qty, line.unitId ?? null);
        line.price = unit.price;
        line.retailPrice = fresh.retailPrice;
        line.wholesalePrice = fresh.wholesalePrice;
        line.wholesaleMinQty = fresh.wholesaleMinQty;
        line.category = fresh.category;
        line.stock = product.stock;
      }
      reprice(state);
    },

    /** العروض السارية تغيّرت (من الكتالوج): تُعاد أسعار الفاتورة المفتوحة. */
    setPromotions(state, action: PayloadAction<PosPromotion[]>) {
      state.promotions = action.payload;
      reprice(state);
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
      reprice(state);
    },

    redo(state) {
      const { past, present, future } = current(state);
      if (future.length === 0) return;
      state.past = [...past, present].slice(-HISTORY_LIMIT);
      state.present = future[0];
      state.future = future.slice(1);
      reprice(state);
    },
  },
});

export const cartActions = cartSlice.actions;
export default cartSlice.reducer;
