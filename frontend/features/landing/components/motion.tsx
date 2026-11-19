"use client";

import {
  m,
  type HTMLMotionProps,
  type Transition,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";

/**
 * حركات الصفحة التعريفية بـ Framer Motion: كل عنصر ينتظر حتى يصل إليه الزائر بالتمرير
 * ثم يظهر مرة واحدة فقط (viewport.once). تستخدم m.* لأن MotionProvider العام (LazyMotion strict)
 * يمنع motion.*، وهو نفسه يحترم «تقليل الحركة» وإيقاف الحركة في الأجهزة الضعيفة.
 */

const EASE: Transition["ease"] = [0.22, 1, 0.36, 1];

const BASE: Transition = { duration: 0.7, ease: EASE };

/** يبدأ الظهور حين يدخل ربع العنصر تقريباً، قبل أسفل الشاشة بقليل. */
const VIEWPORT = {
  once: true,
  amount: 0.2,
  margin: "0px 0px -8% 0px",
} as const;

export type RevealVariant =
  "up" | "fade" | "blur" | "scale" | "zoom" | "start" | "end" | "line";

/** الصفحة RTL: «start» تأتي من اليمين و«end» من اليسار. */
const PRESETS: Record<RevealVariant, Variants> = {
  up: {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: BASE },
  },
  fade: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.8, ease: "easeOut" } },
  },
  blur: {
    hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: EASE },
    },
  },
  scale: {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: BASE },
  },
  zoom: {
    hidden: { opacity: 0, y: 48, scale: 0.92 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 1, ease: EASE },
    },
  },
  start: {
    hidden: { opacity: 0, x: 36 },
    show: { opacity: 1, x: 0, transition: BASE },
  },
  end: {
    hidden: { opacity: 0, x: -36 },
    show: { opacity: 1, x: 0, transition: BASE },
  },
  line: {
    hidden: { scaleX: 0 },
    show: {
      scaleX: 1,
      transition: { duration: 0.9, ease: EASE, delay: 0.15 },
    },
  },
};

// كل عناصر motion تشترك في نفس الواجهة؛ التحويل لتوحيد النوع فقط.
const TAGS = {
  div: m.div,
  section: m.section,
  article: m.article,
  header: m.header,
  figure: m.figure,
  nav: m.nav,
  ul: m.ul,
  ol: m.ol,
  li: m.li,
  p: m.p,
  span: m.span,
  h1: m.h1,
  h2: m.h2,
  details: m.details,
} as unknown as Record<
  | "div"
  | "section"
  | "article"
  | "header"
  | "figure"
  | "nav"
  | "ul"
  | "ol"
  | "li"
  | "p"
  | "span"
  | "h1"
  | "h2"
  | "details",
  typeof m.div
>;

type Tag = keyof typeof TAGS;

type BaseProps = Omit<HTMLMotionProps<"div">, "children"> & {
  as?: Tag;
  children?: ReactNode;
};

/** عنصر مستقل يظهر عند الوصول إليه. */
export function Reveal({
  as = "div",
  variant = "up",
  delay = 0,
  amount,
  children,
  ...props
}: BaseProps & {
  variant?: RevealVariant;
  delay?: number;
  /** نسبة الظهور المطلوبة قبل البدء (0..1). */
  amount?: number;
}) {
  const Comp = TAGS[as];
  const preset = PRESETS[variant];
  const show = preset.show as { transition?: Transition };
  return (
    <Comp
      initial="hidden"
      whileInView="show"
      viewport={amount === undefined ? VIEWPORT : { ...VIEWPORT, amount }}
      variants={{
        hidden: preset.hidden,
        show: {
          ...preset.show,
          transition: {
            ...show.transition,
            delay: (show.transition?.delay ?? 0) + delay,
          },
        },
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

/**
 * حاوية تُظهر عناصرها (StaggerItem) واحداً تلو الآخر.
 * - trigger="view": تنتظر التمرير (الافتراضي).
 * - trigger="mount": تبدأ فور التحميل (لواجهة أعلى الصفحة).
 * - nested: حاوية داخل حاوية أخرى، تتبع والدها وتوزّع التتابع على أبنائها.
 */
export function Stagger({
  as = "div",
  stagger = 0.09,
  delay = 0,
  amount,
  trigger = "view",
  nested = false,
  children,
  ...props
}: BaseProps & {
  stagger?: number;
  delay?: number;
  amount?: number;
  trigger?: "view" | "mount";
  nested?: boolean;
}) {
  const Comp = TAGS[as];
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };

  if (nested) {
    return (
      <Comp variants={variants} {...props}>
        {children}
      </Comp>
    );
  }

  const triggerProps =
    trigger === "mount"
      ? { animate: "show" }
      : {
          whileInView: "show",
          viewport: amount === undefined ? VIEWPORT : { ...VIEWPORT, amount },
        };

  return (
    <Comp initial="hidden" variants={variants} {...triggerProps} {...props}>
      {children}
    </Comp>
  );
}

/**
 * عنصر داخل Stagger. خارج أي حاوية يُعرض كما هو بلا حركة،
 * لذا يمكن استخدامه في مكوّنات مشتركة مع صفحات أخرى.
 */
export function StaggerItem({
  as = "div",
  variant = "up",
  children,
  ...props
}: BaseProps & { variant?: RevealVariant }) {
  const Comp = TAGS[as];
  return (
    <Comp variants={PRESETS[variant]} {...props}>
      {children}
    </Comp>
  );
}
