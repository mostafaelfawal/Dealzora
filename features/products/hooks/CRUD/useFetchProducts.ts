import { auth, db } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { ProductType } from "../../types/ProductType";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

export default function useFetchProducts() {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = useSelector(
    (state: RootState) => state.search.searchQuery
  );
  const categoriesQuery = useSelector(
    (state: RootState) => state.search.categoriesQuery
  );
  const stateQuery = useSelector((state: RootState) => state.search.stateQuery);

  // جلب البيانات من Firestore
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

  // دالة لتطبيق الفلترة (نظيفة ومنفصلة)
  const filterProducts = useCallback(
    (items: ProductType[]) => {
      return items.filter((p) => {
        const matchesSearch =
          !searchQuery ||
          p.name?.toLowerCase().includes(searchQuery.toLowerCase().trim());

        const matchesCategory =
          !categoriesQuery ||
          categoriesQuery === "" ||
          p.categories === categoriesQuery;

        const matchesState =
          !stateQuery ||
          stateQuery === "" ||
          (stateQuery === "موجود" && p.stock! > p.stockAlert!) ||
          (stateQuery === "قليل" &&
            p.stock! > 0 &&
            p.stock! <= p.stockAlert!) ||
          (stateQuery === "منتهي" && p.stock! <= 0);

        return matchesSearch && matchesCategory && matchesState;
      });
    },
    [searchQuery, categoriesQuery, stateQuery]
  );

  // المنتجات المفلترة
  const filteredProducts = filterProducts(products);

  return { products: filteredProducts, loading, error };
}
