"use client";

import { RootState } from "@/store/store";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

export default function useFetchCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const products = useSelector((state: RootState) => state.products.items);

  useEffect(() => {
    try {
      if (!products || products.length === 0) {
        setCategories([]);
        return;
      }

      const uniqueCategories = new Set<string>();
      products.forEach((product: any) => {
        if (product.categories) {
          uniqueCategories.add(product.categories);
        }
      });

      setCategories(Array.from(uniqueCategories));
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء استخراج الفئات من المنتجات");
    }
  }, [products]);

  return { categories, error };
}
