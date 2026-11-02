"use client";

import { useSyncExternalStore } from "react";

/**
 * يرجّع الوقت الحالي ويتحدّث كل فترة.
 * القيمة `null` على السيرفر وفي أول رندر على المتصفح لتفادي اختلاف الـ hydration.
 */
export function useNow(intervalMs = 60_000): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
