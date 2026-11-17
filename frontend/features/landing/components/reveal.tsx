import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * ظهور هادئ عند دخول العنصر للشاشة بـ CSS فقط (animation-timeline: view() في landing.css).
 * المتصفح الذي لا يدعمها، أو «تقليل الحركة»، يعرض المحتوى مباشرة: لا يبقى شيء مخفياً أبداً.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("landing-reveal", className)}>{children}</div>;
}
