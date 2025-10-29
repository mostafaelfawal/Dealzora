import { createAsyncThunk } from "@reduxjs/toolkit";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { ProductType } from "@/features/products/types/ProductType";

export const fetchProducts = createAsyncThunk<
  ProductType[],
  void,
  { rejectValue: string }
>("products/fetchProducts", async (_, thunkAPI) => {
  return new Promise<ProductType[]>((resolve, reject) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      reject("لم يتم تسجيل الدخول");
      return;
    }

    try {
      const productsRef = collection(db, `users/${uid}/products`);

      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          const fetchedProducts = snapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              } as ProductType)
          );
          resolve(fetchedProducts);
          unsubscribe(); // نلغي الاشتراك بعد أول جلب (يمكنك إبقاءه لو تريد التحديث المباشر)
        },
        (error) => {
          console.error("Firestore Error:", error);
          reject("حدث خطأ أثناء جلب البيانات");
        }
      );
    } catch (error) {
      reject("حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات");
    }
  });
});
