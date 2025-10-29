import { useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { fetchProducts } from "@/features/products/slices/fetchProducts";
import { ProductType } from "../../types/ProductType";
import useRealtimeProducts from "../useRealtimeProducts";

export default function useFetchProducts() {
  const dispatch = useDispatch<AppDispatch>();

  const {
    items: allProducts,
    loading,
    error,
  } = useSelector((state: RootState) => state.products);

  const { searchQuery, categoriesQuery, stateQuery } = useSelector(
    (state: RootState) => state.search
  );

  // 🧠 تشغيل التحديث اللحظي
  useRealtimeProducts();

  // 🚀 تحميل أولي فقط لو فارغ
  useEffect(() => {
    if (allProducts.length === 0) dispatch(fetchProducts());
  }, [dispatch]);

  // 🧮 الفلترة
  const filterProducts = useCallback(
    (products: ProductType[]) => {
      const query = searchQuery?.toLowerCase().trim() || "";

      return products.filter((product) => {
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

  const filteredProducts = useMemo(
    () => filterProducts(allProducts),
    [allProducts, filterProducts]
  );

  return { products: filteredProducts, loading, error };
}
