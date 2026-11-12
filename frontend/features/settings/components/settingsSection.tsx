"use client";

import type { ReactNode } from "react";

import { fadeUp, MotionDiv } from "@/components/shared/motion";

/** لوحة القسم المفتوح في الإعدادات: أيقونة + عنوان + وصف + المحتوى. */
export function SettingsSection({
  icon,
  title,
  description,
  children,
  id,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  /** مرساة للروابط المباشرة (مثل /admin/settings#plans) وربط الـ tab بلوحته. */
  id: string;
}) {
  return (
    <MotionDiv
      id={id}
      role="tabpanel"
      aria-labelledby={`settings-tab-${id}`}
      tabIndex={-1}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="border bg-card outline-none"
    >
      <header className="flex items-start gap-3 border-b p-4 sm:p-5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary [&_svg]:size-5"
        >
          {icon}
        </span>
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </MotionDiv>
  );
}
