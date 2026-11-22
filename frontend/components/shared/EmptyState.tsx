import { IconInbox, type Icon } from "@tabler/icons-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * حالة فارغة موحّدة داخل المربعات (تقارير، رسوم، قوائم): أيقونة ثم جملة تشرح السبب.
 * الأيقونة تجعل الفراغ مقصوداً وواضحاً بدل مساحة تبدو كأنها لم تُحمَّل.
 */
export function EmptyState({
  text,
  icon: IconCmp = IconInbox,
  bordered = true,
  className,
  style,
}: {
  text: ReactNode;
  icon?: Icon;
  /** إطار متقطع حول الحالة (يُلغى داخل قائمة أو مربع له إطار أصلاً). */
  bordered?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-3 py-6 text-center text-xs text-muted-foreground",
        bordered && "border border-dashed",
        className,
      )}
      style={style}
    >
      <IconCmp className="size-6 text-muted-foreground/60" aria-hidden />
      <p className="max-w-xs leading-relaxed">{text}</p>
    </div>
  );
}
