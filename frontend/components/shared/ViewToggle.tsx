"use client";

import { IconLayoutGrid, IconList } from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import type { ViewMode } from "@/hooks/useViewMode";
import { plain } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** نفس اختصار صفحات المنتجات والعملاء والمصروفات. */
export const VIEW_TOGGLE_SHORTCUT = { label: "F6", match: plain("F6") };

const OPTIONS = [
  { value: "cards", label: "بطاقات", icon: IconLayoutGrid },
  { value: "table", label: "جدول", icon: IconList },
] as const;

/**
 * زرّا التبديل بين البطاقات والجدول + اختصار F6.
 * hotkey=false لو الصفحة فيها نافذة مفتوحة وتريد إيقاف الاختصار.
 */
export function ViewToggle({
  view,
  onChange,
  hotkey = true,
  className,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  hotkey?: boolean;
  className?: string;
}) {
  useHotkey(VIEW_TOGGLE_SHORTCUT.match, () => {
    if (hotkey) onChange(view === "cards" ? "table" : "cards");
  });

  return (
    <div
      role="group"
      aria-label="طريقة العرض"
      className={cn("flex shrink-0", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }, i) => (
        <AppTooltip
          key={value}
          message={`${label} (${VIEW_TOGGLE_SHORTCUT.label})`}
        >
          <Button
            type="button"
            size="icon-lg"
            variant={view === value ? "default" : "outline"}
            aria-pressed={view === value}
            aria-label={`عرض ${label}`}
            onClick={() => onChange(value)}
            className={cn("size-10", i > 0 && "border-s-0")}
          >
            <Icon className="size-5" />
          </Button>
        </AppTooltip>
      ))}
    </div>
  );
}
