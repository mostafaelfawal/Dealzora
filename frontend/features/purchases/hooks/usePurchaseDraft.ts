import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Product } from "@/features/products/types/product";
import { useOrder } from "@/features/purchaseOrders/hooks/usePurchaseOrders";
import { PURCHASE_ORDER_ROUTES } from "@/features/purchaseOrders/config/purchaseOrderOptions";
import { todayIso } from "@/lib/dates";

import { PURCHASE_ROUTES } from "../config/purchaseRoutes";
import {
  addProductLine,
  draftErrors,
  draftTotals,
  lineError,
  newDraftLine,
  toPurchaseInput,
} from "../lib/purchaseDraft";
import type { PurchaseDraftLine } from "../types/purchase";
import { useCreatePurchase, usePurchaseProducts } from "./usePurchases";

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

  // ?order=<id>: استلام طلب شراء. المورد والأصناف والكميات من الطلب، والمستخدم يصحح للفعلي.
  const orderParam = useSearchParams().get("order");
  const order = useOrder(orderParam);
  const products = usePurchaseProducts();
  const [orderId, setOrderId] = useState<string | null>(null);
  const prefilled = useRef(false);
  useEffect(() => {
    const o = order.data;
    if (prefilled.current || !o || !products.data) return;
    prefilled.current = true;
    if (o.status !== "draft" && o.status !== "sent") return;
    const byId = new Map(products.data.map((p) => [p.id, p]));
    /* eslint-disable react-hooks/set-state-in-effect -- تعبئة لمرة واحدة من الطلب */
    setOrderId(o.id);
    setSupplierId(o.supplierId);
    setNote(`استلام طلب شراء #${o.number}`);
    setLines(
      o.lines.flatMap((l) => {
        const p = byId.get(l.productId);
        if (!p) return [];
        return [
          { ...newDraftLine(p), qty: String(l.qty), cost: String(l.unitCost) },
        ];
      }),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [order.data, products.data]);
  const orderNumber = orderId ? (order.data?.number ?? null) : null;

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
    setOrderId(null);
    setSubmitted(false);
    focusSearch();
  }

  function submit(andNew = false) {
    setSubmitted(true);
    if (errors.length || save.isPending) return;
    save.mutate(
      toPurchaseInput({
        orderId,
        supplierId,
        supplierInvoice,
        date,
        note,
        lines,
        totals,
      }),
      {
        onSuccess: () =>
          andNew
            ? resetForNext()
            : router.push(
                orderId ? PURCHASE_ORDER_ROUTES.list : PURCHASE_ROUTES.list,
              ),
      },
    );
  }

  return {
    searchRef,
    orderNumber,
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
