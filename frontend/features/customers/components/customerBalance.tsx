"use client";

import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

/**
 * رصيد العميل باتجاهه: موجب = مديونية عليه (أحمر)، سالب = رصيد له لدى المحل (أخضر)
 * من باقٍ تركه أو مرتجع لرصيده، وصفر = لا شيء.
 */
export function CustomerBalance({
  balance,
  size = "md",
  className,
}: {
  balance: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text =
    size === "lg"
      ? "text-2xl leading-none"
      : size === "md"
        ? "text-lg font-semibold"
        : "text-sm";
  if (balance > 0)
    return (
      <Money
        amount={balance}
        className={cn(text, "text-destructive", className)}
      />
    );
  if (balance < 0)
    return (
      <span className={cn("inline-flex flex-col", className)}>
        <Money amount={-balance} className={cn(text, "text-success")} />
        <span className="text-[10px] text-success">رصيد له لدى المحل</span>
      </span>
    );
  return (
    <span
      className={cn(
        size === "sm"
          ? "text-muted-foreground"
          : "text-sm font-medium text-success",
        className,
      )}
    >
      لا مديونية
    </span>
  );
}
