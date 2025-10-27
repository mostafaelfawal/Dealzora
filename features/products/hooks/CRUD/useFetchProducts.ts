import { auth, db } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ProductType } from "../../types/ProductType";

export default function useFetchProducts() {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("لم يتم تسجيل الدخول");
      setLoading(false);
      return;
    }

    // 🔹 المرجع إلى مجموعة المنتجات
    const productsRef = collection(db, `users/${uid}/products`);

    // ✅ استماع لحظي للتغييرات
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const fetchedProducts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ProductType[];

        setProducts(fetchedProducts);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore Error:", err);
        setError("حدث خطأ أثناء جلب البيانات");
        setLoading(false);
      }
    );

    // 🧹 إلغاء الاشتراك عند إزالة الكومبوننت
    return () => unsubscribe();
  }, []);

  return { products, loading, error };
}
