"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { listItem, MotionArticle } from "@/components/shared/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const INTERACTIVE =
  "a, button, input, label, [role='switch'], [role='checkbox'], [role='menu'], [role='menuitem']";

export const CARDS_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** شبكة البطاقات داخل AppTable: نفس البيانات والحالات، شكل مختلف. */
export function AppTableCards<T>({
  data,
  getRowId,
  renderCard,
  onCardClick,
  getCardLabel,
  cardClassName,
  className,
}: {
  data: T[];
  getRowId: (row: T) => string;
  renderCard: (row: T, index: number) => ReactNode;
  onCardClick?: (row: T) => void;
  getCardLabel?: (row: T) => string;
  cardClassName?: (row: T) => string | undefined;
  className?: string;
}) {
  return (
    <div className={cn(CARDS_GRID, className)}>
      {data.map((row, index) => {
        const open = onCardClick ? () => onCardClick(row) : undefined;
        return (
          <MotionArticle
            key={getRowId(row)}
            {...listItem(index)}
            tabIndex={open ? 0 : undefined}
            aria-label={getCardLabel?.(row)}
            onClick={
              open
                ? (event: MouseEvent<HTMLElement>) => {
                    const target = event.target as HTMLElement;
                    // أحداث الـ portal (القوائم والنوافذ) تصعد في شجرة React رغم أنها خارج البطاقة.
                    if (!event.currentTarget.contains(target)) return;
                    if (target.closest(INTERACTIVE)) return;
                    open();
                  }
                : undefined
            }
            onKeyDown={
              open
                ? (event: KeyboardEvent<HTMLElement>) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open();
                    }
                  }
                : undefined
            }
            className={cn(
              "flex flex-col gap-3 border bg-card p-3.5 outline-none",
              "transition-[border-color,transform] duration-150",
              open &&
                "cursor-pointer hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99]",
              cardClassName?.(row),
            )}
          >
            {renderCard(row, index)}
          </MotionArticle>
        );
      })}
    </div>
  );
}

export function AppTableCardsSkeleton({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(CARDS_GRID, className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 border bg-card p-3.5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20" />
          <div className="grid grid-cols-2 gap-2 border-t pt-2.5">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- أجزاء موحّدة لمحتوى البطاقة ---------- */

/** رأس البطاقة: عنوان + سطر فرعي + عنصر على الطرف (شارة/مبلغ/قائمة). */
export function CardHead({
  title,
  subtitle,
  aside,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-[13px] leading-snug font-medium">{title}</div>
        {subtitle && (
          <div className="truncate text-[11px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** صف شارات. */
export function CardBadges({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

/** أرقام البطاقة في شبكة: «العنوان» فوق «القيمة»، بخط فاصل من الأعلى. */
export function CardStats({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  const visible = items.filter((item) => !item.hidden);
  return (
    <dl
      className={cn(
        "mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-2.5",
        className,
      )}
    >
      {visible.map((item) => (
        <div key={item.label} className="min-w-0 space-y-0.5">
          <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
          <dd className="truncate text-xs">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** سطر سفلي خافت (التاريخ، بواسطة…). */
export function CardFoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
