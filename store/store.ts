import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/user/userSlice";
import searchProductReducer from "./slices/searchProductSlice";
import productsReducer from "./slices/products/productsSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    search: searchProductReducer,
    products: productsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
