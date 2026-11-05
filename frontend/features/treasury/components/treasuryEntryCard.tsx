"use client";

import { IconArrowDownLeft, IconArrowUpRight } from "@tabler/icons-react";

import { listItem, MotionArticle } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

import { formatDayLabel } from "../lib/treasuryCalc";
import type { CashEntry } from "../types/treasury";
import {
  TreasuryActionsMenu,
  type TreasuryActions,
} from "./treasuryActionsMenu";
import { TreasuryAmount } from "./treasuryAmount";
import { TreasuryEntryBadges } from "./treasuryEntryBadges";

interface TreasuryEntryCardProps extends TreasuryActions {
  entry: CashEntry;
  /** ترتيب البطاقة، لتأخير ظهورها قليلاً عن اللي قبلها. */
  index: number;
}

/** بطاقة حركة خزنة: أيقونة الاتجاه + السبب + المبلغ، والإجراءات في الزاوية. */
export function TreasuryEntryCard({
  entry,
  index,
  ...actions
}: TreasuryEntryCardProps) {
  const isIn = entry.direction === "in";
  const Icon = isIn ? IconArrowDownLeft : IconArrowUpRight;

  return (
    <MotionArticle
      {...listItem(index)}
      className={cn(
        "relative flex flex-col gap-3 border bg-card p-3.5",
        "transition-[border-color] duration-150 hover:border-primary/60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center [&_svg]:size-4",
            isIn
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="line-clamp-1 text-[13px] leading-snug font-medium">
            {entry.note || "بدون ملاحظة"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDayLabel(entry.occurredAt)}
          </p>
        </div>
        <div className="-mt-1 -ms-1 shrink-0">
          <TreasuryActionsMenu entry={entry} {...actions} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <TreasuryEntryBadges entry={entry} />
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-border/60 pt-2.5">
        <TreasuryAmount
          direction={entry.direction}
          amount={entry.amount}
          className="text-lg font-semibold"
        />
        {entry.createdByName && (
          <span className="truncate text-[11px] text-muted-foreground">
            {entry.createdByName}
          </span>
        )}
      </div>
    </MotionArticle>
  );
}
