import { createAsyncThunk } from "@reduxjs/toolkit";
import { SupplierType } from "../types/SupplierType";
import { auth, db } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";

export const fetchSuppliers = createAsyncThunk<
  SupplierType[],
  void,
  { rejectValue: string }
>("", async () => {
  return new Promise<SupplierType[]>((resolve, reject) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      reject("لم يتم تسجيل الدخول");
      return;
    }

    try {
      const suppliersRef = collection(db, `users/${uid}/suppliers`);
      const unsubscribe = onSnapshot(
        suppliersRef,
        (snapshot) => {
          const fetchedSuppliers = snapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              } as SupplierType)
          );
          resolve(fetchedSuppliers);
          unsubscribe();
        },
        (error) => {
          console.error("Firestore Error:", error);
          reject("حدث خطأ أثناء جلب البيانات");
        }
      );
    } catch (error) {
      console.error("Error: ", error);
      reject("حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات");
    }
  });
});
