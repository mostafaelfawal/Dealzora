"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { SuppliersView } from "../types/supplier";

const STORAGE_KEY = "dealzora:suppliers:view";
const CHANGE_EVENT = "dealzora:suppliers-view-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): SuppliersView {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const getServerSnapshot = (): SuppliersView => "cards";

/** طريقة العرض (بطاقات / جدول) مع حفظها في المتصفح. */
export function useSuppliersView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: SuppliersView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // تجاهل.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { view, setView };
}
