"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { ExpensesView } from "../types/expense";

const STORAGE_KEY = "dealzora:expenses:view";
const CHANGE_EVENT = "dealzora:expenses-view-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ExpensesView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const getServerSnapshot = (): ExpensesView => "cards";

/** طريقة العرض (بطاقات / جدول) مع حفظها في المتصفح. */
export function useExpensesView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: ExpensesView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // تجاهل.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { view, setView };
}