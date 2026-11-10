import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  CompletedInvoice,
  PosCategory,
  PosCustomer,
  PosProduct,
} from "../types/pos";

export interface CatalogState {
  products: PosProduct[];
  categories: PosCategory[];
  customers: PosCustomer[];
  /** فواتير مهلة الإرجاع (من GET /sales) للمرتجع والاستبدال. */
  invoices: CompletedInvoice[];
}

const initialState: CatalogState = {
  products: [],
  categories: [],
  customers: [],
  invoices: [],
};

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {
    setCatalog(state, action: PayloadAction<Partial<CatalogState>>) {
      Object.assign(state, action.payload);
    },
    /** بعد حفظ فاتورة: تُضاف أولاً، ويُخصم المباع من الرصيد المحلي فوراً (بدون انتظار إعادة التحميل). */
    addInvoice(state, action: PayloadAction<CompletedInvoice>) {
      const invoice = action.payload;
      state.invoices = [
        invoice,
        ...state.invoices.filter((i) => i.id !== invoice.id),
      ];
      for (const line of invoice.lines) {
        const product = state.products.find((p) => p.id === line.productId);
        if (product)
          product.stock = round3(product.stock - line.qty * line.factor);
      }
    },
    /** يسجّل ما أُرجع على الفاتورة الأصلية ويُرجعه للرصيد المحلي. */
    applyReturn(
      state,
      action: PayloadAction<{
        invoiceId: string;
        /** qty بوحدة البيع، وfactor لتحويلها للوحدة الأساسية. */
        lines: {
          lineId: string;
          productId: string;
          qty: number;
          factor: number;
        }[];
      }>,
    ) {
      const invoice = state.invoices.find(
        (i) => i.id === action.payload.invoiceId,
      );
      if (!invoice) return;
      for (const r of action.payload.lines) {
        const line = invoice.lines.find((l) => l.lineId === r.lineId);
        if (line) line.returnedQty = round3(line.returnedQty + r.qty);
        const product = state.products.find((p) => p.id === r.productId);
        if (product) product.stock = round3(product.stock + r.qty * r.factor);
      }
    },
  },
});

export const catalogActions = catalogSlice.actions;
export default catalogSlice.reducer;
