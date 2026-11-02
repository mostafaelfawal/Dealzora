"use client";

import { useCallback, useEffect, useState } from "react";

import type { ProductsView } from "../types/product";

const STORAGE_KEY = "dealzora:products:view";

/** طريقة العرض (بطاقات / جدول) مع حفظها في المتصفح. */
export function useProductsView() {
  const [view, setViewState] = useState<ProductsView>("cards");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "cards" || saved === "table") setViewState(saved);
    } catch {
      // التخزين غير متاح: نكمل بالقيمة الافتراضية.
    }
  }, []);

  const setView = useCallback((next: ProductsView) => {
    setViewState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // تجاهل.
    }
  }, []);

  return { view, setView };
}
