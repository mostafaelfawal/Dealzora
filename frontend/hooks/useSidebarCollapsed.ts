"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dealzora:sidebar-collapsed";

/** حالة طي القائمة الجانبية مع حفظها في المتصفح. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // التخزين غير متاح: نكمل بالقيمة الافتراضية.
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // تجاهل.
    }
  }, [collapsed]);

  return { collapsed, toggle };
}
