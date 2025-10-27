import { auth, db } from "@/firebase/firebase";
import { addDoc, collection } from "firebase/firestore";
import { ProductType } from "../../types/ProductType";
import { useState } from "react";

export default function useAddProduct() {
  const [error, setError] = useState<string | null>(null);

  const addProduct = async (productData: ProductType) => {
    setError(null);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) setError("لم يتم تسجيل الدخول");
      // ✅ بعد كده نرفع البيانات إلى Firebase
      const productRef = collection(db, `users/${uid}/products`);
      await addDoc(productRef, productData);
      return true;
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      return false;
    }
  };

  return { addProduct, error };
}
