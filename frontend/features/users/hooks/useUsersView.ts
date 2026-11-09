"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { UsersView } from "../types/user";

const STORAGE_KEY = "dealzora:users:view";
const CHANGE_EVENT = "dealzora:users-view-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): UsersView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const getServerSnapshot = (): UsersView => "cards";

/** طريقة العرض (بطاقات / جدول) مع حفظها في المتصفح. */
export function useUsersView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: UsersView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // تجاهل.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { view, setView };
}