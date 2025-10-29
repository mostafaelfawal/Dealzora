import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface InitialState {
  searchQuery: string;
  categoriesQuery: string;
  stateQuery: string;
}

const initialState: InitialState = {
  searchQuery: "",
  categoriesQuery: "",
  stateQuery: "",
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
    setStateQuery: (state, action: PayloadAction<string>) => {
      state.stateQuery = action.payload;
    },
  },
});

export const { setSearchQuery, setcategoriesQuery, setStateQuery } =
  searchProductSlice.actions;
export default searchProductSlice.reducer;
