import { createAsyncThunk } from "@reduxjs/toolkit";
import { auth, db } from "@/firebase/firebase";
import { addDoc, collection } from "firebase/firestore";
import { ProductType } from "../../types/ProductType";

export const addProduct = createAsyncThunk<
  ProductType,
  ProductType,
  { rejectValue: string }
>("", async (productData, { rejectWithValue }) => {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    return rejectWithValue("لم يتم تسجيل الدخول");
  }

  try {
    // إنشاء reference للمجموعة الصحيحة
    const productsRef = collection(db, `users/${uid}/products`);
    const docRef = await addDoc(productsRef, productData);

    return {
      ...productData,
      id: docRef.id,
    } as ProductType;
  } catch (error: any) {
    console.error("Error adding Product:", error);
    return rejectWithValue(error.message || "فشل في إضافة المنتج");
  }
});
