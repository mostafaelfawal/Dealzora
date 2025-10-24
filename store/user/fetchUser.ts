import { UserType } from "@/features/auth/types/UserType";
import { auth, db } from "@/firebase/firebase";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { doc, getDoc } from "firebase/firestore";

export const fetchUser = createAsyncThunk<
  UserType,
  void,
  { rejectValue: string }
>("user/fetchUser", async (_, thunkAPI) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return thunkAPI.rejectWithValue("يرجى تسجيل الدخول أولاً");

    const userDocRef = doc(db, "users", userId);
    const userSnapshot = await getDoc(userDocRef);
    const userData = userSnapshot.data();

    if (!userData) return thunkAPI.rejectWithValue("المستخدم غير موجود");

    return userData as UserType;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير معروف";
    return thunkAPI.rejectWithValue(message);
  }
});
