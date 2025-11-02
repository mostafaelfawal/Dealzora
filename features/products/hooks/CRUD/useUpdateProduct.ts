import { auth, db } from "@/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ProductType } from "../../types/ProductType";
import { useState } from "react";

export default function useUpdateProduct() {
  const [errorU, setError] = useState<string | null>(null);

  const updateProduct = async (productData: ProductType, productId: string) => {
    setError(null);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) setError("لم يتم تسجيل الدخول");
      //  بعد كده نحدث البيانات من Firebase
      const productRef = doc(db, `users/${uid}/products`, productId);
      await setDoc(productRef, productData, { merge: true });
      return true;
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      return false;
    }
  };

  return { updateProduct, errorU };
}
