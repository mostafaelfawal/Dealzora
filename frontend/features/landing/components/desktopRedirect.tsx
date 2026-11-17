"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";

export const DESKTOP_HOME = "/admin/dashboard";

/**
 * داخل برنامج الكمبيوتر (Tauri) تفتح النافذة على "/": نحوّل فوراً للوحة التحكم.
 * useLayoutEffect يعمل قبل أول رسم بعد التحميل، والصفحة مخفية أصلاً بسكربت HIDE_IN_DESKTOP
 * فلا تظهر الصفحة التعريفية لحظة. عند مغادرة الصفحة نعيد إظهار المستند.
 */
export function DesktopRedirect() {
  const router = useRouter();

  useLayoutEffect(() => {
    if (!isTauri()) return;
    const root = document.documentElement;
    root.style.visibility = "hidden";
    router.replace(DESKTOP_HOME);
    return () => {
      root.style.removeProperty("visibility");
    };
  }, [router]);

  return null;
}
