import type { ReactNode } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";

/** شريط عنوان مرئي لنوافذ الاختيار (العنوان الأصلي للقارئات الشاشية يبقى في CommandDialog). */
export function PosPickerHeader({
  icon,
  title,
  meta,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <div
      aria-hidden
      className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2.5"
    >
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="text-sm font-medium">{title}</span>
      {meta && <span className="text-xs text-muted-foreground">· {meta}</span>}
    </div>
  );
}

/** تلميحات الكيبورد أسفل النافذة (تظهر فقط مع الفأرة/الكيبورد، وتُخفى على اللمس). */
export function PosPickerFooter({
  hints,
}: {
  hints: { keys: string; label: string }[];
}) {
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground pointer-fine:flex">
      {hints.map((hint) => (
        <span key={hint.keys} className="flex items-center gap-1.5">
          <ShortcutBadge className="rounded-none">{hint.keys}</ShortcutBadge>
          {hint.label}
        </span>
      ))}
    </div>
  );
}

/** تنسيق موحّد لصفوف القوائم: شريط تمييز جانبي عند التحديد بالأسهم أو الفأرة. */
export const pickerItemClass =
  "relative gap-3 rounded-none px-3 py-2.5 before:absolute before:inset-y-0 before:inset-s-0 before:w-0.5 before:bg-primary before:opacity-0 before:content-[''] data-[selected=true]:before:opacity-100";
