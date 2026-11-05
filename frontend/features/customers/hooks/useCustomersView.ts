import { useCallback, useSyncExternalStore } from "react";

import type { CustomersView } from "../types/customer";

const STORAGE_KEY = "dealzora:customer:view";
const CHANGE_EVENT = "dealzora:customer-view-change";

function subscribe(onChange: VoidFunction) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): CustomersView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const getServerSnapshot = (): CustomersView => "cards";

/** طريقة العرض تُحفظ على الجهاز. نبدأ بالبطاقات ثم نقرأ المحفوظ بعد التحميل لتفادي hydration mismatch. */
export function useCustomersView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: CustomersView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { view, setView };
}
