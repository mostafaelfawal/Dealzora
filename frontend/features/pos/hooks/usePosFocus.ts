"use client";

import { useEffect } from "react";
import type { MouseEvent } from "react";

import { useAppSelector } from "@/lib/store/hooks";
import { focusSearch, hasFinePointer } from "../lib/posFocus";

/** يخلّي التركيز على خانة الباركود دايماً. بيرجّع handler للنقر على جذر الشاشة. */
export function usePosFocus() {
  const dialogOpen = useAppSelector((s) => s.posUi.dialog !== null);

  // عند أول تحميل وبعد إغلاق أي نافذة: يعود التركيز إلى خانة الباركود.
  useEffect(() => {
    if (dialogOpen || !hasFinePointer()) return;
    const id = window.setTimeout(() => focusSearch(), 30);
    return () => window.clearTimeout(id);
  }, [dialogOpen]);

  // قارئ الباركود يكتب أرقاماً: لو التركيز مش في خانة إدخال نرجعه قبل ما الحرف يضيع.
  useEffect(() => {
    if (dialogOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1 || event.key === " ") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      focusSearch(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen]);

  return function handleRootClick(event: MouseEvent<HTMLDivElement>) {
    if (dialogOpen || !hasFinePointer()) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "input, textarea, select, [data-slot='popover-trigger'], [data-slot='popover-content'], [data-slot='dropdown-menu-trigger'], [data-slot='dropdown-menu-content']",
      )
    )
      return;
    focusSearch();
  };
}
