import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProductType } from "@/features/products/types/ProductType";
import { fetchProducts } from "./fetchProducts";

interface ProductsState {
  items: ProductType[];
  loading: boolean;
  error: string | null;
}

const initialState: ProductsState = {
  items: [],
  loading: false,
  error: null,
};

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    setProducts: (state, action: PayloadAction<ProductType[]>) => {
      state.items = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchProducts.fulfilled,
        (state, action: PayloadAction<ProductType[]>) => {
          state.loading = false;
          state.items = action.payload;
        }
      )
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "حدث خطأ أثناء تحميل المنتجات";
      });
  },
});

export const { setProducts } = productsSlice.actions;
export default productsSlice.reducer;
