"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * نسخ نصٍّ إلى الحافظة مع حالة `copied` تبقى صحيحة لمدة قصيرة،
 * ليعرض الزر علامة صحّ بدل أيقونة النسخ ثم يعود إليها.
 * `copy` لا تَرمي خطأً: تُرجع true عند النجاح وfalse عند الفشل.
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs],
  );

  return { copied, copy };
}
