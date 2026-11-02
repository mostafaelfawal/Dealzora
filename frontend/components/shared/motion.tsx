"use client";

import { LazyMotion, MotionConfig, domAnimation, m } from "framer-motion";
import type { ReactNode } from "react";
import type { Transition, Variants } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * ضع <MotionProvider> مرة واحدة في الـ layout الرئيسي.
 * - LazyMotion + domAnimation: حزمة أصغر بكثير (مهم للأجهزة الضعيفة).
 * - strict: يمنع استخدام motion.* بالغلط (لازم m.*).
 * - reducedMotion="user": يحترم إعداد "تقليل الحركة" في الجهاز تلقائياً.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/* ---------- العناصر ---------- */
export const MotionDiv = m.div;
export const MotionA = m.a;
export const MotionForm = m.form;
export const MotionArticle = m.article;
export const MotionLi = m.li;
export const MotionUl = m.ul;
export const MotionSpan = m.span;
export const MotionTr = m.tr;
export const MotionButton = m.button;

/* ---------- Transitions سريعة (الكاشير لا ينتظر) ---------- */
export const tFast: Transition = { duration: 0.15, ease: "easeOut" };
export const tBase: Transition = { duration: 0.25, ease: "easeOut" };
export const tSpring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

/* ---------- Variants جاهزة (opacity + transform فقط) ---------- */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tBase },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: tBase },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: tSpring },
};

/** تأخير متدرج للقوائم، بحد أقصى حتى لا تتأخر القوائم الطويلة. */
export function stagger(index: number, step = 0.025, max = 12): Transition {
  return { ...tBase, delay: Math.min(index, max) * step };
}

/** props جاهزة لعنصر داخل قائمة: <MotionArticle {...listItem(index)} /> */
export function listItem(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: stagger(index) },
  };
}

/** نفس الفكرة لصفوف الجدول (fade فقط، الـ transform على tr غير مستقر). */
export function listRow(index: number) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: stagger(index, 0.02) },
  };
}

/**
 * شريط تقدّم يتحرك بـ scaleX بدل width (أخف بكثير، بلا reflow).
 * يدعم RTL: الأصل من اليمين في العربي.
 */
export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  /** من 0 إلى 1 */
  value: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <span aria-hidden className={cn("block h-1 w-full bg-muted", className)}>
      <m.span
        className={cn(
          "block h-full w-full bg-primary ltr:origin-left rtl:origin-right",
          barClassName,
        )}
        initial={false}
        animate={{ scaleX: Math.min(Math.max(value, 0), 1) }}
        transition={tBase}
      />
    </span>
  );
}
