// Clean My Code | Mostafa Hamdi
import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useSelector } from "react-redux";
import { auth, db } from "@/firebase/firebase";
import { ProductType } from "../../types/ProductType";
import { RootState } from "@/store/store";

export default function useFetchProducts() {
  const [allProducts, setAllProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔍 Selectors
  const { searchQuery, categoriesQuery, stateQuery } = useSelector(
    (state: RootState) => state.search
  );

  /** 🧭 جلب المنتجات من Firestore */
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
        const fetched = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as ProductType)
        );
        setAllProducts(fetched);
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

  /** 🧮 دالة الفلترة */
  const filterProducts = useCallback(
    (products: ProductType[]) => {
      return products.filter((product) => {
        const query = searchQuery?.toLowerCase().trim() || "";

        const matchesSearch =
          !query ||
          product.name?.toLowerCase().includes(query) ||
          product.code?.toLowerCase().includes(query);

        const matchesCategory =
          !categoriesQuery ||
          categoriesQuery === "" ||
          product.categories === categoriesQuery;

        const matchesState =
          !stateQuery ||
          stateQuery === "" ||
          (stateQuery === "موجود" && product.stock! > product.stockAlert!) ||
          (stateQuery === "قليل" &&
            product.stock! > 0 &&
            product.stock! <= product.stockAlert!) ||
          (stateQuery === "منتهي" && product.stock! <= 0);

        return matchesSearch && matchesCategory && matchesState;
      });
    },
    [searchQuery, categoriesQuery, stateQuery]
  );

  /** ⚙️ استخدام useMemo لتقليل إعادة التصفيات */
  const filteredProducts = useMemo(
    () => filterProducts(allProducts),
    [allProducts, filterProducts]
  );

  return {
    products: filteredProducts,
    loading,
    error,
  };
}
