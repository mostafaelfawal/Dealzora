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
  /** TODO: لا يوجد endpoint للفواتير بعد. */
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
    /** يسجّل ما أُرجع على الفاتورة الأصلية (عدّاد المرتجع فقط). */
    applyReturn(
      state,
      action: PayloadAction<{
        invoiceId: string;
        lines: { productId: string; qty: number }[];
      }>,
    ) {
      const invoice = state.invoices.find(
        (i) => i.id === action.payload.invoiceId,
      );
      if (!invoice) return;
      for (const r of action.payload.lines) {
        const line = invoice.lines.find((l) => l.productId === r.productId);
        if (line) line.returnedQty = round3(line.returnedQty + r.qty);
      }
    },
  },
});

export const catalogActions = catalogSlice.actions;
export default catalogSlice.reducer;
