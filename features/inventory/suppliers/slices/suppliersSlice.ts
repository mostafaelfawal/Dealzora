import { createSlice } from "@reduxjs/toolkit";
import { SupplierType } from "../types/SupplierType";
import { fetchSuppliers } from "./fetchSuppliers";

type SuppliersState = {
  suppliers: SupplierType[];
  loading: boolean;
  error: string | null;
};

const initialState: SuppliersState = {
  suppliers: [],
  loading: false,
  error: null,
};

const suppliersSlice = createSlice({
  name: "suppliers",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(fetchSuppliers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.loading = false;
        state.suppliers = action.payload;
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "حدث خطأ غير معروف";
      });
  },
});

export default suppliersSlice.reducer;
