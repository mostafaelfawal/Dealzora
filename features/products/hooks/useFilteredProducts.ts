import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

export function useFilteredProducts() {
  const { searchQuery, categoriesQuery, stateQuery } = useSelector(
    (state: RootState) => state.search
  );
  const products = useSelector((state: RootState) => state.products.products);

  const filteredProducts = products.filter((product) => {
    // البحث بالاسم والكود
    if (
      searchQuery &&
      !(
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ) {
      return false;
    }

    // تصفية بالفئة
    if (
      categoriesQuery &&
      categoriesQuery !== "" &&
      product.categories !== categoriesQuery
    ) {
      return false;
    }

    // تصفية بالحالة
    const stock = product.stock ?? 0;
    const alert = product.stockAlert ?? 0;

    if (stateQuery === "in" && !(stock > alert)) return false;
    if (stateQuery === "low" && !(stock <= alert && stock > 0)) return false;
    if (stateQuery === "out" && stock !== 0) return false;

    return true;
  });

  return filteredProducts;
}
