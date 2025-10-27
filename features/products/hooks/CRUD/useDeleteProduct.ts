import { auth, db } from "@/firebase/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";

export default function useDeleteProduct() {
  const [error, setError] = useState<string | null>(null);

  const deleteProduct = async (id: string) => {
    setError(null);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) setError("لم يتم تسجيل الدخول");
      // ✅ بعد كده نحذف البيانات من Firebase
      const productRef = doc(db, `users/${uid}/products/${id}`);
      await deleteDoc(productRef);
      return true;
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      return false;
    }
  };

  return { deleteProduct, error };
}
