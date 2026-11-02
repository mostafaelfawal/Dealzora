import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ExchangeDraft } from "../types/pos";

export interface ExchangeState {
  /** مسودة الاستبدال الجارية (null = لا يوجد استبدال). */
  draft: ExchangeDraft | null;
  /** الفاتورة المختارة حالياً في نافذة المرتجع. */
  pendingInvoiceId: string | null;
}

const initialState: ExchangeState = { draft: null, pendingInvoiceId: null };

const exchangeSlice = createSlice({
  name: "exchange",
  initialState,
  reducers: {
    setPending(state, action: PayloadAction<string | null>) {
      state.pendingInvoiceId = action.payload;
    },
    start(state, action: PayloadAction<ExchangeDraft>) {
      state.draft = action.payload;
      state.pendingInvoiceId = null;
    },
    clear(state) {
      state.draft = null;
      state.pendingInvoiceId = null;
    },
  },
});

export const exchangeActions = exchangeSlice.actions;
export default exchangeSlice.reducer;
