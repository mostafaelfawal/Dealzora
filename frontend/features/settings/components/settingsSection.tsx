"use client";

import type { ReactNode } from "react";

import { fadeUp, MotionDiv } from "@/components/shared/motion";

/** بطاقة قسم في صفحة الإعدادات: أيقونة + عنوان + وصف + المحتوى. */
export function SettingsSection({
  icon,
  title,
  description,
  children,
  index,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  index: number;
}) {
  return (
    <MotionDiv
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.05 }}
      className="space-y-3 border bg-card p-4"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </MotionDiv>
  );
}
