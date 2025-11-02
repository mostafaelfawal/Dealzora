import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SupplierType } from "../types/SupplierType";

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
  reducers: {
    setSuppliers(state, action: PayloadAction<SupplierType[]>) {
      state.suppliers = action.payload;
      state.loading = false;
    },
    setLoading(state) {
      state.loading = true;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { setSuppliers, setLoading, setError } = suppliersSlice.actions;
export default suppliersSlice.reducer;
