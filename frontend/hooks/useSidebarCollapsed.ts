"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "dealzora:sidebar-collapsed";
const CHANGE_EVENT = "dealzora:sidebar-collapsed-change";

function subscribe(onChange: () => void) {
  // يشتغل لما التغيير يحصل من نفس التبويب (حدثنا المخصص) أو من تبويب تاني (storage).
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // التخزين غير متاح: القيمة الافتراضية.
  }
}

// على السيرفر (SSR) القيمة الافتراضية دايماً.
function getServerSnapshot(): boolean {
  return false;
}

/** حالة طي القائمة الجانبية مع حفظها في المتصفح. */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      // تجاهل.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [collapsed]);

  return { collapsed, toggle };
}
