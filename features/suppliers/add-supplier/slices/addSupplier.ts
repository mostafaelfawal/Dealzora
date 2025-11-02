// addSupplier.ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import { auth, db } from "@/firebase/firebase";
import { addDoc, collection } from "firebase/firestore";
import { SupplierType } from "../../types/SupplierType";

export const addSupplier = createAsyncThunk<
  SupplierType,
  SupplierType,
  { rejectValue: string }
>("", async (supplierData, { rejectWithValue }) => {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    return rejectWithValue("لم يتم تسجيل الدخول");
  }

  try {
    // إنشاء reference للمجموعة الصحيحة
    const suppliersRef = collection(db, `users/${uid}/suppliers`);
    const docRef = await addDoc(suppliersRef, supplierData);

    return {
      ...supplierData,
      id: docRef.id,
    } as SupplierType;
  } catch (error: any) {
    console.error("Error adding supplier:", error);
    return rejectWithValue(error.message || "فشل في إضافة المورد");
  }
});
