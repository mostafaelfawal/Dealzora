import { useCallback, useSyncExternalStore } from "react";

import type { TreasuryView } from "../types/treasury";

const STORAGE_KEY = "dealzora:treasury:view";
const CHANGE_EVENT = "dealzora:treasury-view-change";

function subscribe(onChange: VoidFunction) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): TreasuryView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

const getServerSnapshot = (): TreasuryView => "table";

/** الخزنة سجل حركات، فالجدول هو الافتراضي. الاختيار يُحفظ على الجهاز. */
export function useTreasuryView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: TreasuryView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { view, setView };
}
