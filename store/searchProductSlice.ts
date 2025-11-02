import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type stateType = "all" | "in" | "low" | "out";

interface InitialState {
  searchQuery: string;
  categoriesQuery: string;
  stateQuery: stateType;
}

const initialState: InitialState = {
  searchQuery: "",
  categoriesQuery: "",
  stateQuery: "all",
};

const searchProductSlice = createSlice({
  name: "searchProduct",
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setcategoriesQuery: (state, action: PayloadAction<string>) => {
      state.categoriesQuery = action.payload;
    },
    setStateQuery: (state, action: PayloadAction<stateType>) => {
      state.stateQuery = action.payload;
    },
  },
});

export const { setSearchQuery, setcategoriesQuery, setStateQuery } =
  searchProductSlice.actions;
export default searchProductSlice.reducer;
