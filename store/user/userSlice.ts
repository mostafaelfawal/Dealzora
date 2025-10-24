import { UserType } from "@/features/auth/types/UserType";
import { createSlice } from "@reduxjs/toolkit";
import { fetchUser } from "./fetchUser";

interface UserState {
  currentUser: UserType | null;
  errorMessage: string;
  isLoading: boolean;
}

const initialState: UserState = {
  currentUser: null,
  errorMessage: "",
  isLoading: false,
};

// Slice لإدارة حالة المستخدم
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.isLoading = true;
        state.errorMessage = "";
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentUser = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.isLoading = false;
        state.errorMessage = action.payload ?? "";
      });
  },
});

export const {} = userSlice.actions;
export default userSlice.reducer;
