"use client";

import { useSyncExternalStore } from "react";

/** هل يطابق استعلام الوسائط الآن (مثلاً شاشة صغيرة)؟ السيرفر يرى false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
