import { auth, db } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ProductType } from "../../types/ProductType";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

export default function useFetchProducts() {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 🟡 القيم المأخوذة من Redux
  const searchQuery = useSelector(
    (state: RootState) => state.search.searchQuery
  );
  const categoriesQuery = useSelector(
    (state: RootState) => state.search.categoriesQuery
  );
  const stateQuery = useSelector((state: RootState) => state.search.stateQuery);

  // 📦 جلب المنتجات من Firestore
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("لم يتم تسجيل الدخول");
      setLoading(false);
      return;
    }

    const productsRef = collection(db, `users/${uid}/products`);

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

    return () => unsubscribe();
  }, []);

  // 🔎 فلترة المنتجات حسب البحث + الفئة + الحالة
  useEffect(() => {
    let filtered = [...products];

    // فلترة البحث
    const queryLower = searchQuery.toLowerCase().trim();
    if (queryLower) {
      filtered = filtered.filter((p) =>
        p.name?.toLowerCase().includes(queryLower)
      );
    }

    // فلترة الفئة
    if (categoriesQuery && categoriesQuery !== "الكل") {
      filtered = filtered.filter((p) => p.categories === categoriesQuery);
    }

    // ✅ فلترة الحالة
    if (stateQuery && stateQuery !== "") {
      filtered = filtered.filter((p) => {
        if (stateQuery === "موجود") return p.stock! > p.stockAlert!; // كمية كافية
        if (stateQuery === "قليل")
          return p.stock! > 0 && p.stock! <= p.stockAlert!; // أقل من التحذير
        if (stateQuery === "منتهي") return p.stock! <= 0; // غير متوفر
        return true;
      });
    }

    setFilteredProducts(filtered);
  }, [searchQuery, categoriesQuery, stateQuery, products]);

  return { products: filteredProducts, loading, error };
}
