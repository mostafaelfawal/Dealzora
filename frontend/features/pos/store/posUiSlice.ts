import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PaymentMethod } from "../types/pos";
import { cartActions } from "./cartSlice";

export type PosDialog =
  | "payment"
  | "discount"
  | "customer"
  | "held"
  | "cancel"
  | "shortcuts"
  | "returnPicker"
  | "return"
  | "exchange";

export type MobileView = "products" | "cart";

export interface PosUiState {
  query: string;
  activeIndex: number;
  notFound: string | null;
  category: string;
  dialog: PosDialog | null;
  paymentMethod: PaymentMethod;
  /** فتحنا اختيار العميل من داخل الدفع، فنرجع للدفع بعد الإغلاق. */
  reopenPayment: boolean;
  mobileView: MobileView;
}

const initialState: PosUiState = {
  query: "",
  activeIndex: 0,
  notFound: null,
  category: "all",
  dialog: null,
  paymentMethod: "cash",
  reopenPayment: false,
  mobileView: "products",
};

function clearEntry(state: PosUiState) {
  state.query = "";
  state.activeIndex = 0;
  state.notFound = null;
}

/** بعد ما الفاتورة تخلص (إلغاء أو دفع): نرجع لشاشة الأصناف بخانة فاضية. */
function finishInvoice(state: PosUiState) {
  clearEntry(state);
  state.dialog = null;
  state.mobileView = "products";
}

const posUiSlice = createSlice({
  name: "posUi",
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
      state.activeIndex = 0;
      state.notFound = null;
    },
    setActiveIndex(state, action: PayloadAction<number>) {
      state.activeIndex = action.payload;
    },
    setNotFound(state, action: PayloadAction<string | null>) {
      state.notFound = action.payload;
    },
    setCategory(state, action: PayloadAction<string>) {
      state.category = action.payload;
    },
    setMobileView(state, action: PayloadAction<MobileView>) {
      state.mobileView = action.payload;
    },

    openDialog(state, action: PayloadAction<PosDialog>) {
      state.dialog = action.payload;
    },
    closeDialog(state) {
      state.dialog = null;
    },
    openPayment(state, action: PayloadAction<PaymentMethod | undefined>) {
      state.paymentMethod = action.payload ?? "cash";
      state.dialog = "payment";
    },
    pickCustomerFromPayment(state, action: PayloadAction<PaymentMethod>) {
      state.paymentMethod = action.payload;
      state.reopenPayment = true;
      state.dialog = "customer";
    },
    /** إغلاق اختيار العميل: نرجع للدفع لو جينا منه. */
    closeCustomerDialog(state) {
      state.dialog = state.reopenPayment ? "payment" : null;
      state.reopenPayment = false;
    },
  },
  // الواجهة بتتفاعل مع أحداث الفاتورة هنا بدل ما كل مكوّن يفتكر يعملها.
  extraReducers: (builder) => {
    builder
      .addCase(cartActions.addProduct, clearEntry)
      .addCase(cartActions.holdInvoice, (state) => {
        clearEntry(state);
        state.mobileView = "products";
      })
      .addCase(cartActions.recallHeld, (state) => {
        state.dialog = null;
        state.mobileView = "cart";
      })
      .addCase(cartActions.cancelInvoice, finishInvoice)
      .addCase(cartActions.completeInvoice, finishInvoice);
  },
});

export const posUiActions = posUiSlice.actions;
export default posUiSlice.reducer;
