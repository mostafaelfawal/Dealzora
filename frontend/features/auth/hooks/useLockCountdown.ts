"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/axios";

/**
 * عدّاد تنازلي لقفل الحساب بعد محاولات دخول خاطئة متكررة.
 * `startFromError` تُستدعى من onError: لو كان الخطأ قفلاً تبدأ العدّ بالثواني التي أرسلها الخادم.
 * العداد مستقل عن رسالة الخطأ، فلا يختفي بمسحها عند الكتابة في الحقول.
 */
export function useLockCountdown() {
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const startFromError = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || error.code !== "account_locked") return;
    const seconds = Number(error.details?.retry_after_seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const start = Date.now();
    setNow(start);
    setUnlockAt(start + seconds * 1000);
  }, []);

  const clear = useCallback(() => setUnlockAt(null), []);

  useEffect(() => {
    if (unlockAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= unlockAt) setUnlockAt(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [unlockAt]);

  const seconds =
    unlockAt === null ? 0 : Math.max(0, Math.ceil((unlockAt - now) / 1000));
  return { seconds, startFromError, clear };
}

/** 125 → "2:05" */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
