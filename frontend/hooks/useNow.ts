"use client";

import { useEffect, useState } from "react";

/**
 * يرجّع الوقت الحالي ويتحدّث كل فترة.
 * القيمة `null` قبل التحميل على المتصفح لتفادي اختلاف السيرفر والعميل (hydration).
 */
export function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
