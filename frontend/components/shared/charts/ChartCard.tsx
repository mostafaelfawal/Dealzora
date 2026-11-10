"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { fadeUp, MotionDiv } from "@/components/shared/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** إطار موحّد لكل رسم: عنوان + سطر يشرح "لماذا يهمك" + إجراء/رابط + المحتوى. */
export function ChartCard({
  title,
  subtitle,
  action,
  href,
  children,
  className,
  loading,
  index = 0,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  href?: string;
  children: ReactNode;
  className?: string;
  loading?: boolean;
  index?: number;
}) {
  return (
    <MotionDiv
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className={cn("flex min-w-0 flex-col gap-3 border bg-card p-3 sm:p-4", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {href && (
            <Link href={href} className="text-xs text-primary hover:underline">
              التفاصيل
            </Link>
          )}
        </div>
      </header>
      {loading ? <Skeleton className="h-48 w-full" /> : children}
    </MotionDiv>
  );
}

/** حالة فارغة داخل الرسم (بدل محاور فاضية). */
export function ChartEmpty({ text, height = 180 }: { text: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center border border-dashed text-xs text-muted-foreground"
      style={{ height }}
    >
      {text}
    </div>
  );
}
