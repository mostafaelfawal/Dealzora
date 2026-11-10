"use client";

import { useEffect } from "react";

import { isFileDrag } from "@/hooks/useFileDrop";

/**
 * شبكة أمان للتطبيق كله: إفلات ملف في أي مكان لا يستقبله لا يجعل WebView2
 * يفتح الملف ويغادر التطبيق (يحدث لأن dragDropEnabled=false في Tauri).
 * الأماكن التي تستقبل ملفات (useFileDrop، منطقة الاستيراد) تعمل كما هي.
 */
export function FileDropGuard() {
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (isFileDrag(e)) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);
  return null;
}
