"use client";

import { useEffect, useRef } from "react";

/**
 * شبكة دفتر الحسابات خلف القسم، مع توهج يتبع مؤشر الفأرة فوق خطوطها.
 * الحركة تُكتب في متغيرات CSS مباشرة (بلا إعادة رسم React)، وتتوقف مع اللمس و«تقليل الحركة».
 * يوضع داخل عنصر relative isolate (سياق تراص مستقل) فتبقى الطبقتان خلف كل محتواه،
 * ويستمع لحركة الفأرة على ذلك العنصر كله.
 */
export function GridBackground() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    const host = glow?.parentElement;
    if (!glow || !host) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      glow.style.setProperty("--mx", `${x}px`);
      glow.style.setProperty("--my", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
      glow.dataset.active = "";
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      delete glow.dataset.active;
    };

    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="landing-grid pointer-events-none absolute inset-0 -z-10"
      />
      <div
        ref={glowRef}
        aria-hidden
        className="landing-grid-glow pointer-events-none absolute inset-0 -z-10"
      />
    </>
  );
}
