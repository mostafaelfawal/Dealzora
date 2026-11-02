import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/lib/store";
import { calcTotals, parseEntry, searchProducts } from "../lib/posCalc";
import { resolveSelectedId } from "./cartSlice";
import { calcSettlement, returnValue } from "../lib/returnCalc";

/* ---------- الفاتورة ---------- */

export const selectInvoice = (s: RootState) => s.cart.present;
export const selectLines = (s: RootState) => s.cart.present.lines;
export const selectInvoiceCustomer = (s: RootState) => s.cart.present.customer;
export const selectInvoiceDiscount = (s: RootState) => s.cart.present.discount;
export const selectHeld = (s: RootState) => s.cart.held;
export const selectIsEmpty = (s: RootState) =>
  s.cart.present.lines.length === 0;
export const selectCanUndo = (s: RootState) => s.cart.past.length > 0;
export const selectCanRedo = (s: RootState) => s.cart.future.length > 0;

export const selectTotals = createSelector([selectInvoice], calcTotals);

export const selectSelectedId = createSelector(
  [selectLines, (s: RootState) => s.cart.selectedId],
  resolveSelectedId,
);

/* ---------- الكتالوج ---------- */

export const selectProducts = (s: RootState) => s.catalog.products;
export const selectCategories = (s: RootState) => s.catalog.categories;
export const selectCustomers = (s: RootState) => s.catalog.customers;

export const selectVisibleProducts = createSelector(
  [selectProducts, (s: RootState) => s.posUi.category],
  (products, category) =>
    category === "all"
      ? products
      : products.filter((p) => p.category === category),
);

/* ---------- البحث ---------- */

export const selectQuery = (s: RootState) => s.posUi.query;

/** صيغة "3*باركود": الكمية والنص. */
export const selectEntry = createSelector([selectQuery], parseEntry);

export const selectIsSearching = (s: RootState) => selectEntry(s).term !== "";

export const selectSearchResults = createSelector(
  [selectEntry, selectProducts],
  (entry, products) => searchProducts(products, entry.term),
);

export const selectSafeIndex = createSelector(
  [(s: RootState) => s.posUi.activeIndex, selectSearchResults],
  (index, results) => Math.min(index, Math.max(results.length - 1, 0)),
);

/* ---------- الاستبدال / المرتجع ---------- */

export const selectInvoices = (s: RootState) => s.catalog.invoices;
export const selectExchange = (s: RootState) => s.exchange.draft;

export const selectPendingInvoice = createSelector(
  [selectInvoices, (s: RootState) => s.exchange.pendingInvoiceId],
  (invoices, id) => invoices.find((i) => i.id === id) ?? null,
);

export const selectReturnTotal = createSelector([selectExchange], (draft) =>
  draft ? returnValue(draft.lines, draft.discountRate) : 0,
);

export const selectSettlement = createSelector(
  [selectTotals, selectReturnTotal],
  (totals, returnTotal) => calcSettlement(totals.total, returnTotal),
);
