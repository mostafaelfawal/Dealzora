import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState: { searchQuery: string } = { searchQuery: "" };

const searchProductSlice = createSlice({
  name: "searchProduct",
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
});

export const { setSearchQuery } = searchProductSlice.actions;
export default searchProductSlice.reducer;
