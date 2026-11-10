"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** أزرار تبويب/فلتر أفقية قابلة للتمرير على الموبايل (نفس شكل فلاتر الخزنة). */
export function SegmentedTabs<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("no-scrollbar flex gap-1.5 overflow-x-auto", className)}
    >
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="sm"
          variant={value === item.id ? "default" : "outline"}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
          className="shrink-0 gap-1.5 font-normal"
        >
          {item.label}
          {item.count !== undefined && item.count > 0 && (
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                value === item.id
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {item.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
