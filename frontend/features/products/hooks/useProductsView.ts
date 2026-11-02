"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { ProductsView } from "../types/product";

const STORAGE_KEY = "dealzora:products:view";
const CHANGE_EVENT = "dealzora:products-view-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ProductsView {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const getServerSnapshot = (): ProductsView => "cards";

/** طريقة العرض (بطاقات / جدول) مع حفظها في المتصفح. */
export function useProductsView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: ProductsView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // تجاهل.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { view, setView };
}
