import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { Product } from "@/features/products/types/product";
import { todayIso } from "@/lib/dates";

import { PURCHASE_ROUTES } from "../config/purchaseRoutes";
import {
  addProductLine,
  draftErrors,
  draftTotals,
  lineError,
  toPurchaseInput,
} from "../lib/purchaseDraft";
import type { PurchaseDraftLine } from "../types/purchase";
import { useCreatePurchase } from "./usePurchases";

/** حالة فاتورة الشراء الجديدة وحساباتها والتحقق منها والحفظ. */
export function usePurchaseDraft() {
  const router = useRouter();
  const save = useCreatePurchase();
  const searchRef = useRef<HTMLInputElement>(null);

  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [date, setDate] = useState(todayIso);
  const [lines, setLines] = useState<PurchaseDraftLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const totals = draftTotals(lines, discount, paid);
  const lineErrors = lines.map(lineError);
  const errors = draftErrors({ supplierId, lines, lineErrors, totals });

  const focusSearch = () => searchRef.current?.focus();

  function addProduct(p: Product) {
    setLines((prev) => addProductLine(prev, p));
    focusSearch();
  }

  function patchLine(key: string, patch: Partial<PurchaseDraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  /** يُبقي المورد والتاريخ لتسجيل فاتورة أخرى من نفس المورد بسرعة. */
  function resetForNext() {
    setLines([]);
    setDiscount("");
    setPaid("");
    setNote("");
    setSupplierInvoice("");
    setSubmitted(false);
    focusSearch();
  }

  function submit(andNew = false) {
    setSubmitted(true);
    if (errors.length || save.isPending) return;
    save.mutate(
      toPurchaseInput({
        supplierId,
        supplierInvoice,
        date,
        note,
        lines,
        totals,
      }),
      {
        onSuccess: () =>
          andNew ? resetForNext() : router.push(PURCHASE_ROUTES.list),
      },
    );
  }

  return {
    searchRef,
    header: {
      supplierId,
      setSupplierId,
      supplierInvoice,
      setSupplierInvoice,
      date,
      setDate,
    },
    lines,
    lineErrors,
    addProduct,
    patchLine,
    removeLine,
    discount,
    setDiscount,
    paid,
    setPaid,
    note,
    setNote,
    totals,
    errors,
    submitted,
    isSaving: save.isPending,
    submit,
  };
}

export type PurchaseDraft = ReturnType<typeof usePurchaseDraft>;
