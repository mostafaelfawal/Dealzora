import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { POS_CATEGORIES, POS_CUSTOMERS, POS_PRODUCTS } from "../mocks/posData";
import type { PosCategory, PosCustomer, PosProduct } from "../types/pos";

export interface CatalogState {
  products: PosProduct[];
  categories: PosCategory[];
  customers: PosCustomer[];
}

/** TODO: بدّل البيانات التجريبية بنتيجة الـ API (dispatch(catalogActions.setCatalog(...))). */
const initialState: CatalogState = {
  products: POS_PRODUCTS,
  categories: POS_CATEGORIES,
  customers: POS_CUSTOMERS,
};

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {
    setCatalog(state, action: PayloadAction<Partial<CatalogState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const catalogActions = catalogSlice.actions;
export default catalogSlice.reducer;
