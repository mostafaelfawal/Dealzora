"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { listRow, MotionButton, MotionDiv } from "./motion";

interface StatTileProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  /** سطر صغير تحت الرقم (مقارنة، تنبيه…). */
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  active?: boolean;
  /** وجودها يحوّل البطاقة لزر (فلتر سريع أو انتقال). */
  onClick?: () => void;
  index?: number;
}

const TONES = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
} as const;

/** بطاقة رقم سريع. نفس شكل بطاقات الخزنة والمصروفات. */
export function StatTile({
  icon,
  label,
  children,
  hint,
  tone = "default",
  active,
  onClick,
  index = 0,
}: StatTileProps) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center [&_svg]:size-4",
          active ? "bg-primary text-primary-foreground" : TONES[tone],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block truncate text-xs text-muted-foreground">
          {label}
        </span>
        <span className="block text-lg leading-none font-semibold">
          {children}
        </span>
        {hint && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </>
  );

  const className = cn(
    "flex items-center gap-3 border bg-card p-3 text-start",
    onClick &&
      "cursor-pointer outline-none transition-[border-color,transform] duration-150 hover:border-primary/60 active:scale-[0.98] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
    active && "border-primary",
  );

  // opacity فقط: الـ transform محجوز لتأثير الضغط (active:scale).
  const motionProps = listRow(index);

  return onClick ? (
    <MotionButton
      {...motionProps}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={className}
    >
      {body}
    </MotionButton>
  ) : (
    <MotionDiv {...motionProps} className={className}>
      {body}
    </MotionDiv>
  );
}
