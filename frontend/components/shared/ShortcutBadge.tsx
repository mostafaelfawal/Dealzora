import { cn } from "@/lib/utils";

interface ShortcutBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function ShortcutBadge({ children, className }: ShortcutBadgeProps) {
  return (
    <kbd
      dir="ltr"
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center rounded border px-1.5 font-mono text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
