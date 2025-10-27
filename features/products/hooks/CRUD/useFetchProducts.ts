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

  const searchQuery = useSelector(
    (state: RootState) => state.search.searchQuery
  );

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

  // 🔎 فلترة المنتجات بناءً على البحث
  useEffect(() => {
    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) {
      setFilteredProducts(products);
      return;
    }

    const filtered = products.filter((p) =>
      p.name?.toLowerCase().includes(queryLower)
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  return { products: filteredProducts, loading, error };
}
