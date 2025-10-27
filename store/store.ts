import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./user/userSlice";
import searchProductReducer from "./search/searchProductSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    search: searchProductReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
