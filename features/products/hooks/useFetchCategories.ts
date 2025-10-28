import { auth, db } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function useFetchCategories() {
  const [error, setError] = useState<string | null>(null);
  const [categories, setcategories] = useState<string[]>([]);

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
        const uniquecategories = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.categories) {
            uniquecategories.add(data.categories);
          }
        });

        setcategories(Array.from(uniquecategories));
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
