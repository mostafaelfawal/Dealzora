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
/** TODO: الرقم الحقيقي بيجي من الـ API وقت الحفظ. */
const FIRST_INVOICE_NUMBER = 1043;

const EMPTY_INVOICE: PosInvoice = { lines: [], customer: null, discount: null };

interface Persisted {
  invoice: PosInvoice;
  held: HeldInvoice[];
  nextNumber: number;
}

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

/**
 * حالة الفاتورة الحالية + المعلّقة.
 * بتتحفظ في localStorage عشان قطع الكهربا أو الريفريش ميضيّعوش فاتورة شغالة.
 */
export function usePosCart() {
  const [invoice, setInvoice] = useState<PosInvoice>(EMPTY_INVOICE);
  const [held, setHeld] = useState<HeldInvoice[]>([]);
  const [nextNumber, setNextNumber] = useState(FIRST_INVOICE_NUMBER);
  const [rawSelectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const lastRemoved = useRef<{ line: CartLine; index: number } | null>(null);

  /* ---------- تحميل وحفظ ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<Persisted>;
        if (data.invoice && Array.isArray(data.invoice.lines)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setInvoice(data.invoice);
          setSelectedId(data.invoice.lines.at(-1)?.productId ?? null);
        }
        if (Array.isArray(data.held)) setHeld(data.held);
        if (typeof data.nextNumber === "number") setNextNumber(data.nextNumber);
      }
    } catch {
      // بيانات تالفة أو التخزين غير متاح: نبدأ فاتورة جديدة.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const data: Persisted = { invoice, held, nextNumber };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // تجاهل.
    }
  }, [ready, invoice, held, nextNumber]);

  /* ---------- مشتقات ---------- */

  const totals = useMemo(() => calcTotals(invoice), [invoice]);

  const selectedId = invoice.lines.some((l) => l.productId === rawSelectedId)
    ? rawSelectedId
    : (invoice.lines.at(-1)?.productId ?? null);

  /* ---------- الأصناف ---------- */

  const addProduct = useCallback((product: PosProduct, qty = 1) => {
    setInvoice((prev) => {
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
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.productId === id ? { ...l, qty: clampQty(qty, l.allowDecimal) } : l,
      ),
    }));
    setSelectedId(id);
  }, []);

  /** +/- : القطعة بخطوة 1، والوزن بخطوة 0.5. مبينزلش تحت الحد الأدنى. */
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
      setInvoice((prev) => ({
        ...prev,
        lines: prev.lines.filter((l) => l.productId !== id),
      }));
      setSelectedId(rest[Math.min(index, rest.length - 1)]?.productId ?? null);
      return line;
    },
    [invoice.lines],
  );

  const undoRemove = useCallback(() => {
    const removed = lastRemoved.current;
    if (!removed) return;
    lastRemoved.current = null;
    setInvoice((prev) => {
      if (prev.lines.some((l) => l.productId === removed.line.productId))
        return prev;
      const lines = [...prev.lines];
      lines.splice(Math.min(removed.index, lines.length), 0, removed.line);
      return { ...prev, lines };
    });
    setSelectedId(removed.line.productId);
  }, []);

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

  const setCustomer = useCallback((customer: PosCustomer | null) => {
    setInvoice((prev) => ({ ...prev, customer }));
  }, []);

  const setDiscount = useCallback((discount: InvoiceDiscount | null) => {
    setInvoice((prev) => ({ ...prev, discount }));
  }, []);

  /* ---------- تعليق / استرجاع / إنهاء ---------- */

  const holdInvoice = useCallback(() => {
    if (invoice.lines.length === 0) return false;
    setHeld((prev) => [{ id: newId(), heldAt: Date.now(), invoice }, ...prev]);
    setInvoice(EMPTY_INVOICE);
    setSelectedId(null);
    return true;
  }, [invoice]);

  /** لو الفاتورة الحالية فيها أصناف بتتعلّق تلقائي بدل ما تتمسح. */
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
      setInvoice(target.invoice);
      setSelectedId(target.invoice.lines.at(-1)?.productId ?? null);
      return { swapped };
    },
    [held, invoice],
  );

  const cancelInvoice = useCallback(() => {
    setInvoice(EMPTY_INVOICE);
    setSelectedId(null);
  }, []);

  /** يقفل الفاتورة بعد الدفع ويرجّع رقمها. TODO: استبدلها بحفظ حقيقي عبر الـ API. */
  const completeInvoice = useCallback(() => {
    const number = nextNumber;
    setNextNumber(number + 1);
    setInvoice(EMPTY_INVOICE);
    setSelectedId(null);
    return number;
  }, [nextNumber]);

  return {
    invoice,
    totals,
    held,
    selectedId,
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
