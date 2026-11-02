import {
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from "@reduxjs/toolkit";

import cartReducer from "@/features/pos/store/cartSlice";
import catalogReducer from "@/features/pos/store/catalogSlice";
import posUiReducer from "@/features/pos/store/posUiSlice";
import exchangeReducer from "@/features/pos/store/exchangeSlice";

const isServer = typeof window === "undefined";

export const makeStore = () =>
  configureStore({
    reducer: {
      cart: cartReducer,
      posUi: posUiReducer,
      catalog: catalogReducer,
      exchange: exchangeReducer,
    },
    // فحوصات التطوير تستخدم Math.random()، وهذا ممنوع أثناء الـ prerender في السيرفر.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware(
        isServer
          ? { immutableCheck: false, serializableCheck: false }
          : undefined,
      ),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<R = void> = ThunkAction<
  R,
  RootState,
  unknown,
  UnknownAction
>;
