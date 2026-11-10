import { plain } from "@/lib/shortcuts";

import type { PurchaseStatusFilter, RefundMethod } from "../types/purchase";

export const PURCHASE_FORM_SHORTCUTS = {
  save: { label: "F9", match: plain("F9") },
} as const;

/** أقصى عدد نتائج في قائمة البحث عن صنف. */
export const PURCHASE_SEARCH_LIMIT = 8;

export const PURCHASE_FIELD_IDS = {
  supplierInvoice: "pf-ref",
  date: "pf-date",
  note: "pf-note",
  discount: "pf-discount",
  paid: "pf-paid",
} as const;

export const PURCHASE_LIMITS = {
  supplierInvoice: 40,
  note: 200,
} as const;

export const PURCHASES_SHORTCUTS = {
  newPurchase: { label: "F4", match: plain("F4") },
} as const;

export const PURCHASE_STATUS_TABS: {
  id: PurchaseStatusFilter;
  label: string;
}[] = [
  { id: "all", label: "كل الفواتير" },
  { id: "credit", label: "فيها آجل" },
  { id: "returned", label: "عليها مرتجع" },
];

export const PURCHASE_PAGE_SIZES = [12, 24, 48];
export const PURCHASE_DEFAULT_PAGE_SIZE = 24;
export const PURCHASE_SEARCH_DEBOUNCE_MS = 300;

export const REFUND_METHODS: { id: RefundMethod; label: string }[] = [
  { id: "balance", label: "خصم من مستحقات المورد" },
  { id: "cash", label: "استلمت نقداً" },
];
