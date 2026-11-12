"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ViewMode = "cards" | "table";

const CHANGE_EVENT = "dealzora:view-mode-change";
const storageKey = (page: string) => `dealzora:${page}:view`;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * طريقة العرض (بطاقات / جدول) لصفحة معيّنة، محفوظة على هذا الجهاز.
 * السيرفر يرى القيمة الافتراضية ثم نقرأ المحفوظ بعد التحميل (بلا hydration mismatch).
 */
export function useViewMode(page: string, fallback: ViewMode = "table") {
  const getSnapshot = useCallback((): ViewMode => {
    try {
      const saved = localStorage.getItem(storageKey(page));
      return saved === "cards" || saved === "table" ? saved : fallback;
    } catch {
      return fallback;
    }
  }, [page, fallback]);

  const view = useSyncExternalStore(subscribe, getSnapshot, () => fallback);

  const setView = useCallback(
    (next: ViewMode) => {
      try {
        localStorage.setItem(storageKey(page), next);
      } catch {
        // وضع التصفح الخاص أو تخزين ممتلئ: نكتفي بعدم الحفظ.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [page],
  );

  return { view, setView };
}
