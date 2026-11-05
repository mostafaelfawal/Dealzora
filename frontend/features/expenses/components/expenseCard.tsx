"use client";

import { IconCalendar, IconUser } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionArticle } from "@/components/shared/motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { categoryLabel, formatDate } from "../lib/expenseCalc";
import type { Expense } from "../types/expense";
import { ExpenseActionsMenu, type ExpenseActions } from "./expenseActionsMenu";

interface ExpenseCardProps extends ExpenseActions {
  expense: Expense;
  /** ترتيب البطاقة، لتأخير ظهورها قليلاً عن اللي قبلها. */
  index: number;
}

/** بطاقة مصروف. الملاحظة زر يغطي البطاقة كلها (تعديل)، وقائمة الإجراءات فوقه. */
export function ExpenseCard({ expense, index, ...actions }: ExpenseCardProps) {
  return (
    <MotionArticle
      {...listItem(index)}
      className={cn(
        "group relative flex flex-col gap-3 border bg-card p-3.5",
        "transition-[border-color,transform] duration-150",
        "hover:border-primary/60 active:scale-[0.99]",
        "focus-within:border-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Badge variant="outline" className="font-normal">
            {categoryLabel(expense.category)}
          </Badge>
          <button
            type="button"
            onClick={() => actions.onEdit(expense.id)}
            className="line-clamp-2 w-full text-start text-[13px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-primary/40"
          >
            {expense.note || (
              <span className="font-normal text-muted-foreground">
                بدون ملاحظة
              </span>
            )}
          </button>
        </div>
        <div className="relative z-10 -mt-1 -ms-1 shrink-0">
          <ExpenseActionsMenu expense={expense} {...actions} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-border/60 pt-2.5">
        <Money amount={expense.amount} className="text-lg font-semibold" />
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          <p className="flex items-center justify-end gap-1.5">
            <IconCalendar className="size-3.5" aria-hidden />
            {formatDate(expense.spentAt)}
          </p>
          {expense.createdByName && (
            <p className="flex items-center justify-end gap-1.5">
              <IconUser className="size-3.5" aria-hidden />
              {expense.createdByName}
            </p>
          )}
        </div>
      </div>
    </MotionArticle>
  );
}
