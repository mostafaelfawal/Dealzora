"use client";

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

/**
 * F11 = تبديل وضع ملء الشاشة لنافذة البرنامج.
 * في المتصفح يتولى المتصفح نفسه F11، فلا نتدخل إلا داخل برنامج الكمبيوتر.
 */
export function FullscreenHotkey() {
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();

    async function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "F11" || event.repeat) return;
      event.preventDefault();
      try {
        await win.setFullscreen(!(await win.isFullscreen()));
      } catch {
        // تجاهل: النافذة لا تدعم ملء الشاشة أو الإذن غير متاح.
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
