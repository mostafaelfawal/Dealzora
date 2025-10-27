import { auth, db } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function useFetchCategories() {
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("لم يتم تسجيل الدخول");
      return;
    }

    // 🔹 المرجع إلى مجموعة المنتجات
    const productsRef = collection(db, `users/${uid}/products`);

    // 🔹 الاشتراك في التحديثات اللحظية
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const uniqueCategories = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.category) {
            uniqueCategories.add(data.category);
          }
        });

        setCategories(Array.from(uniqueCategories));
      },
      (err) => {
        console.error(err);
        setError("حدث خطأ أثناء تحميل الفئات");
      }
    );

    // 🔹 تنظيف الاشتراك عند إلغاء التثبيت
    return () => unsubscribe();
  }, []);

  return { categories, error };
}
