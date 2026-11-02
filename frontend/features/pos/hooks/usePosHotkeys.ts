"use client";

import { useEffect } from "react";

import { useHotkey } from "@/hooks/useHotkey";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { focusSearch, selectSearchText } from "../lib/posFocus";
import {
  holdCurrentInvoice,
  redoInvoice,
  requestDialog,
  requestPayment,
  undoInvoice,
} from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";

/** كل اختصارات شاشة الكاشير. بتشتغل بس لما مفيش نافذة مفتوحة. */
export function usePosHotkeys() {
  const dispatch = useAppDispatch();
  const dialogOpen = useAppSelector((s) => s.posUi.dialog !== null);

  const whenIdle = (fn: () => void) => () => {
    if (!dialogOpen) fn();
  };

  useHotkey(
    POS_SHORTCUTS.focusSearch.match,
    whenIdle(() => {
      focusSearch(true);
      selectSearchText();
    }),
  );
  useHotkey(
    POS_SHORTCUTS.heldList.match,
    whenIdle(() => dispatch(posUiActions.openDialog("held"))),
  );
  useHotkey(
    POS_SHORTCUTS.holdInvoice.match,
    whenIdle(() => dispatch(holdCurrentInvoice())),
  );
  useHotkey(
    POS_SHORTCUTS.customer.match,
    whenIdle(() => dispatch(posUiActions.openDialog("customer"))),
  );
  useHotkey(
    POS_SHORTCUTS.cancelInvoice.match,
    whenIdle(() => dispatch(requestDialog("cancel"))),
  );
  useHotkey(
    POS_SHORTCUTS.discount.match,
    whenIdle(() => dispatch(requestDialog("discount"))),
  );
  useHotkey(
    POS_SHORTCUTS.pay.match,
    whenIdle(() => dispatch(requestPayment())),
  );
  useHotkey(
    POS_SHORTCUTS.help.match,
    whenIdle(() => dispatch(posUiActions.openDialog("shortcuts"))),
  );

  // التراجع/الإعادة: Ctrl+Z و Ctrl+Shift+Z (أو Ctrl+Y).
  // نستمع مباشرة (وليس عبر useHotkey) لنفحص الحقل المركَّز قبل منع السلوك الافتراضي.
  useEffect(() => {
    if (dialogOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      const isUndo = POS_SHORTCUTS.undo.match(event);
      const isRedo = !isUndo && POS_SHORTCUTS.redo.match(event);
      if (!isUndo && !isRedo) return;

      // داخل حقل فيه نص نترك التراجع الأصلي للمتصفح (تراجع الكتابة).
      const target = event.target as HTMLElement | null;
      if (
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement) &&
        target.value !== ""
      )
        return;

      event.preventDefault();
      dispatch(isUndo ? undoInvoice() : redoInvoice());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, dispatch]);
}
