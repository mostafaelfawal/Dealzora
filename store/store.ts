import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/auth/slices/userSlice";
import searchProductReducer from "./searchProductSlice";
import productsReducer from "../features/products/slices/productsSlice";
import suppliersReducer from "../features/inventory/suppliers/slices/suppliersSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    search: searchProductReducer,
    products: productsReducer,
    suppliers: suppliersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
