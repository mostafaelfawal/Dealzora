"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { calcTotals, clampQty } from "../lib/posCalc";
import type {
  CartLine,
  HeldInvoice,
  InvoiceDiscount,
  PosCustomer,
  PosInvoice,
  PosProduct,
} from "../types/pos";

const STORAGE_KEY = "dealzora:pos:v1";
/** TODO: الرقم الحقيقي يأتي من الـ API وقت الحفظ. */
const FIRST_INVOICE_NUMBER = 1043;
/** أقصى عدد من خطوات التراجع المحفوظة. */
const HISTORY_LIMIT = 50;

const EMPTY_INVOICE: PosInvoice = { lines: [], customer: null, discount: null };

interface Persisted {
  invoice: PosInvoice;
  held: HeldInvoice[];
  nextNumber: number;
}

/** سجل تعديلات الفاتورة الحالية (للتراجع والإعادة). */
interface History {
  past: PosInvoice[];
  present: PosInvoice;
  future: PosInvoice[];
}

const INITIAL_HISTORY: History = {
  past: [],
  present: EMPTY_INVOICE,
  future: [],
};

const freshHistory = (invoice: PosInvoice): History => ({
  past: [],
  present: invoice,
  future: [],
});

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function toLine(product: PosProduct, qty: number): CartLine {
  return {
    productId: product.id,
    name: product.name,
    barcode: product.barcode,
    unit: product.unit,
    price: product.price,
    qty: clampQty(qty, product.allowDecimal),
    allowDecimal: product.allowDecimal,
    stock: product.stock,
  };
}

function loadPersisted(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

/**
 * حالة الفاتورة الحالية + المعلّقة.
 * تُحفظ في localStorage حتى لا يضيّع انقطاع الكهرباء أو تحديث الصفحة فاتورة قيد العمل.
 *
 * التراجع/الإعادة (undo/redo) يشمل تعديلات الفاتورة الحالية فقط
 * (إضافة، كمية، حذف، عميل، خصم). أما التعليق والاسترجاع والإلغاء والدفع
 * فتبدأ سجلاً جديداً، لأنها تنقل الفاتورة خارج الشاشة أو تُنهيها.
 */
export function usePosCart() {
  const [initial] = useState(loadPersisted);
  const [history, setHistory] = useState<History>(() =>
    initial.invoice && Array.isArray(initial.invoice.lines)
      ? freshHistory(initial.invoice)
      : INITIAL_HISTORY,
  );
  const [held, setHeld] = useState<HeldInvoice[]>(() =>
    Array.isArray(initial.held) ? initial.held : [],
  );

  const [nextNumber, setNextNumber] = useState(() =>
    typeof initial.nextNumber === "number"
      ? initial.nextNumber
      : FIRST_INVOICE_NUMBER,
  );
  const [rawSelectedId, setSelectedId] = useState<string | null>(
    () => initial.invoice?.lines?.at(-1)?.productId ?? null,
  );
  const lastRemoved = useRef<{ line: CartLine; index: number } | null>(null);

  const invoice = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  /* ---------- سجل التعديلات ---------- */

  /** تعديل قابل للتراجع. إن لم يتغير شيء (نفس المرجع) لا يُسجَّل. */
  const commit = useCallback((updater: (prev: PosInvoice) => PosInvoice) => {
    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  /** استبدال الفاتورة وبدء سجل جديد (تعليق، استرجاع، إلغاء، دفع). */
  const reset = useCallback((next: PosInvoice) => {
    setHistory(freshHistory(next));
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, []);

  useEffect(() => {
    try {
      const data: Persisted = { invoice, held, nextNumber };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // تجاهل.
    }
  }, [invoice, held, nextNumber]);

  /* ---------- مشتقات ---------- */

  const totals = useMemo(() => calcTotals(invoice), [invoice]);

  const selectedId = invoice.lines.some((l) => l.productId === rawSelectedId)
    ? rawSelectedId
    : (invoice.lines.at(-1)?.productId ?? null);

  /* ---------- الأصناف ---------- */

  const addProduct = useCallback(
    (product: PosProduct, qty = 1) => {
      commit((prev) => {
        const exists = prev.lines.some((l) => l.productId === product.id);
        const lines = exists
          ? prev.lines.map((l) =>
              l.productId === product.id
                ? { ...l, qty: clampQty(l.qty + qty, l.allowDecimal) }
                : l,
            )
          : [...prev.lines, toLine(product, qty)];
        return { ...prev, lines };
      });
      setSelectedId(product.id);
    },
    [commit],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      commit((prev) => {
        const target = prev.lines.find((l) => l.productId === id);
        if (!target) return prev;
        const next = clampQty(qty, target.allowDecimal);
        if (next === target.qty) return prev;
        return {
          ...prev,
          lines: prev.lines.map((l) =>
            l.productId === id ? { ...l, qty: next } : l,
          ),
        };
      });
      setSelectedId(id);
    },
    [commit],
  );

  /** +/- : القطعة بخطوة 1، والوزن بخطوة 0.5. لا ينزل تحت الحد الأدنى. */
  const changeQty = useCallback(
    (id: string, direction: 1 | -1) => {
      const line = invoice.lines.find((l) => l.productId === id);
      if (!line) return;
      const step = line.allowDecimal ? 0.5 : 1;
      const next = line.qty + direction * step;
      if (next < (line.allowDecimal ? 0.5 : 1)) return;
      setQty(id, next);
    },
    [invoice.lines, setQty],
  );

  const removeLine = useCallback(
    (id: string): CartLine | null => {
      const index = invoice.lines.findIndex((l) => l.productId === id);
      if (index < 0) return null;
      const line = invoice.lines[index];
      const rest = invoice.lines.filter((l) => l.productId !== id);
      lastRemoved.current = { line, index };
      commit((prev) => ({
        ...prev,
        lines: prev.lines.filter((l) => l.productId !== id),
      }));
      setSelectedId(rest[Math.min(index, rest.length - 1)]?.productId ?? null);
      return line;
    },
    [invoice.lines, commit],
  );

  /** زر «تراجع» في إشعار الحذف: يعيد الصنف المحذوف في مكانه. */
  const undoRemove = useCallback(() => {
    const removed = lastRemoved.current;
    if (!removed) return;
    lastRemoved.current = null;
    commit((prev) => {
      if (prev.lines.some((l) => l.productId === removed.line.productId))
        return prev;
      const lines = [...prev.lines];
      lines.splice(Math.min(removed.index, lines.length), 0, removed.line);
      return { ...prev, lines };
    });
    setSelectedId(removed.line.productId);
  }, [commit]);

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      const ids = invoice.lines.map((l) => l.productId);
      if (ids.length === 0) return;
      const current = selectedId ? ids.indexOf(selectedId) : -1;
      const next =
        current === -1
          ? direction === 1
            ? 0
            : ids.length - 1
          : Math.min(Math.max(current + direction, 0), ids.length - 1);
      setSelectedId(ids[next]);
    },
    [invoice.lines, selectedId],
  );

  /* ---------- بيانات الفاتورة ---------- */

  const setCustomer = useCallback(
    (customer: PosCustomer | null) => {
      commit((prev) =>
        (prev.customer?.id ?? null) === (customer?.id ?? null)
          ? prev
          : { ...prev, customer },
      );
    },
    [commit],
  );

  const setDiscount = useCallback(
    (discount: InvoiceDiscount | null) => {
      commit((prev) => {
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
    [commit],
  );

  /* ---------- تعليق / استرجاع / إنهاء ---------- */

  const holdInvoice = useCallback(() => {
    if (invoice.lines.length === 0) return false;
    setHeld((prev) => [{ id: newId(), heldAt: Date.now(), invoice }, ...prev]);
    reset(EMPTY_INVOICE);
    setSelectedId(null);
    return true;
  }, [invoice, reset]);

  /** إذا كانت الفاتورة الحالية فيها أصناف فإنها تُعلَّق تلقائياً بدل أن تُمسح. */
  const recallHeld = useCallback(
    (id: string) => {
      const target = held.find((h) => h.id === id);
      if (!target) return;
      const swapped = invoice.lines.length > 0;
      setHeld((prev) => {
        const rest = prev.filter((h) => h.id !== id);
        return swapped
          ? [{ id: newId(), heldAt: Date.now(), invoice }, ...rest]
          : rest;
      });
      reset(target.invoice);
      setSelectedId(target.invoice.lines.at(-1)?.productId ?? null);
      return { swapped };
    },
    [held, invoice, reset],
  );

  const cancelInvoice = useCallback(() => {
    reset(EMPTY_INVOICE);
    setSelectedId(null);
  }, [reset]);

  /** يُقفل الفاتورة بعد الدفع ويرجع رقمها. TODO: استبدلها بحفظ حقيقي عبر الـ API. */
  const completeInvoice = useCallback(() => {
    const number = nextNumber;
    setNextNumber(number + 1);
    reset(EMPTY_INVOICE);
    setSelectedId(null);
    return number;
  }, [nextNumber, reset]);

  return {
    invoice,
    totals,
    held,
    selectedId,
    canUndo,
    canRedo,
    undo,
    redo,
    addProduct,
    setQty,
    changeQty,
    removeLine,
    undoRemove,
    selectLine: setSelectedId,
    moveSelection,
    setCustomer,
    setDiscount,
    holdInvoice,
    recallHeld,
    cancelInvoice,
    completeInvoice,
  };
}
