"use client";

import { MotionGlobalConfig, animate } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * حركة دخول الصفحة: عند فتح أي صفحة تظهر عناصرها الرئيسية (العنوان، البطاقات،
 * شريط الأدوات، المحتوى...) بالتتابع مع انزلاق خفيف للأعلى.
 *
 * يعمل تلقائياً بلا تعديل في الشاشات: يبحث عن جذر الشاشة (أول عنصر له أكثر من
 * ابن واحد) ويحرّك أبناءه المباشرين. ولو استُبدل المحتوى بعد التحميل (مؤشر انتظار
 * ← الشاشة الفعلية) يحرّك المحتوى الجديد أيضاً خلال نافذة قصيرة بعد الانتقال.
 *
 * يحترم إعدادات الحركة الحالية كما هي: الإيقاف اليدوي أو الجهاز الضعيف
 * (MotionGlobalConfig.skipAnimations من lib/motionPreference) وخيار
 * "تقليل الحركة" في نظام التشغيل؛ عندها لا يُلمس أي عنصر.
 */

/** المدة التي نراقب فيها ظهور المحتوى بعد الانتقال (تحميل البيانات، الصلاحيات...). */
const WATCH_MS = 2000;
/** أقصى عمق نتجاوز فيه الأغلفة ذات الابن الواحد. */
const MAX_DEPTH = 5;
/** بعد هذا العدد يظهر الباقي مع آخر عنصر، حتى لا تتأخر الصفحات الطويلة. */
const MAX_STAGGERED = 7;

const DURATION = 0.5;
const STEP = 0.04;
const OFFSET_Y = 10;
// easeOutQuint تقريباً: بداية سريعة ونهاية ناعمة.
const EASE = [0.22, 1, 0.36, 1] as const;

function motionDisabled(): boolean {
  if (MotionGlobalConfig.skipAnimations) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** جذر الشاشة: ننزل عبر الأغلفة ذات الابن الواحد حتى نصل لعنصر فيه عدة أقسام. */
function findContentRoot(host: Element): Element {
  let el = host;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const only = el.children.length === 1 ? el.children[0] : null;
    if (!(only instanceof HTMLElement)) break;
    el = only;
  }
  return el;
}

function isAnimatable(el: Element): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    // مؤشرات التحميل تبقى كما هي (مثل globals.css).
    !el.classList.contains("animate-spin") &&
    !el.classList.contains("animate-pulse")
  );
}

function clearStyles(el: HTMLElement) {
  el.style.removeProperty("opacity");
  el.style.removeProperty("transform");
}

export function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hostRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect + MutationObserver (microtask): نخفي العناصر قبل أول رسم فلا يحدث وميض.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || motionDisabled()) return;

    const seen = new WeakSet<Element>();
    const running = new Set<{ stop: () => void }>();
    const touched = new Set<HTMLElement>();

    const run = () => {
      const root = findContentRoot(host);
      const items: HTMLElement[] = [];
      // جذر بلا أقسام (صفحة من عنصر واحد): نحرّكه هو نفسه.
      const pool =
        root.children.length > 0 || root === host
          ? Array.from(root.children)
          : [root];
      for (const el of pool) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (isAnimatable(el)) items.push(el);
      }
      if (items.length === 0) return;

      for (const el of items) {
        el.style.opacity = "0";
        el.style.transform = `translateY(${OFFSET_Y}px)`;
        touched.add(el);
      }

      const controls = animate(
        items,
        { opacity: [0, 1], y: [OFFSET_Y, 0] },
        {
          duration: DURATION,
          ease: EASE,
          delay: (i: number) => Math.min(i, MAX_STAGGERED) * STEP,
        },
      );
      running.add(controls);
      controls.then(() => {
        running.delete(controls);
        for (const el of items) {
          clearStyles(el);
          touched.delete(el);
        }
      });
    };

    run();

    const observer = new MutationObserver(run);
    observer.observe(host, { childList: true, subtree: true });
    const timer = window.setTimeout(() => observer.disconnect(), WATCH_MS);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      for (const c of running) c.stop();
      // لا نترك عنصراً مخفياً لو غادر المستخدم الصفحة في منتصف الحركة.
      for (const el of touched) clearStyles(el);
    };
  }, [pathname]);

  // display: contents: الغلاف لا يغيّر التخطيط إطلاقاً.
  return (
    <div ref={hostRef} className="contents">
      {children}
    </div>
  );
}
