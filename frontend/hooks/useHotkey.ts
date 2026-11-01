"use client";

import { useEffect, useRef } from "react";

/** يسجّل اختصار كيبورد على مستوى النافذة. */
export function useHotkey(
  match: (event: KeyboardEvent) => boolean,
  handler: () => void,
) {
  const matchRef = useRef(match);
  const handlerRef = useRef(handler);

  useEffect(() => {
    matchRef.current = match;
    handlerRef.current = handler;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchRef.current(event)) return;
      event.preventDefault();
      handlerRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
