import { auth, db } from "@/firebase/firebase";
import { addDoc, collection } from "firebase/firestore";
import { ProductType } from "../../types/ProductType";
import { useState } from "react";

export default function useAddProduct() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const addProduct = async (productData: ProductType) => {
    setLoading(true);
    setError(null);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) setError("لم يتم العثور على المستخدم الحالي");

      const productRef = collection(db, `users/${uid}/products`);
      await addDoc(productRef, productData);

      return true;
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { addProduct, loading, error };
}
