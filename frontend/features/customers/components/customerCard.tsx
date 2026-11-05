"use client";

import { IconCash, IconPhone } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionArticle } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatDaysAgo, initialOf } from "../lib/customerCalc";
import type { Customer } from "../types/customer";
import { CustomerActionsMenu, type CustomerActions } from "./customerActionsMenu";
import { CustomerCreditMeter } from "./customerCreditMeter";
import { CustomerStatusBadges } from "./customerStatusBadges";

interface CustomerCardProps extends CustomerActions {
  customer: Customer;
  /** ترتيب البطاقة، لتأخير ظهورها قليلاً عن اللي قبلها. */
  index: number;
}

/** بطاقة عميل. الاسم يفتح كشف الحساب ويغطي البطاقة كلها، والإجراءات فوقه. */
export function CustomerCard({ customer, index, ...actions }: CustomerCardProps) {
  const hasDebt = customer.balance > 0;

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
      <div
        className={cn(
          "flex items-start gap-2.5",
          !customer.isActive && "opacity-60",
        )}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center bg-muted text-sm font-medium text-muted-foreground"
        >
          {initialOf(customer.name)}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <button
            type="button"
            onClick={() => actions.onStatement(customer.id)}
            className="line-clamp-1 w-full text-start text-[13px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-primary/40"
          >
            {customer.name}
          </button>
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <IconPhone className="size-3.5 shrink-0" aria-hidden />
            <span
              dir="ltr"
              className="min-w-0 truncate text-start font-mono text-[11px]"
            >
              {customer.phone || "بدون رقم"}
            </span>
          </span>
        </div>
        <div className="relative z-10 -mt-1 -ms-1 shrink-0">
          <CustomerActionsMenu customer={customer} {...actions} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
        <CustomerStatusBadges customer={customer} />
      </div>

      <div
        className={cn(
          "flex items-end justify-between gap-2 border-t border-border/60 pt-2.5",
          !customer.isActive && "opacity-60",
        )}
      >
        <div className="space-y-0.5">
          <p className="text-[11px] text-muted-foreground">المديونية</p>
          {hasDebt ? (
            <Money
              amount={customer.balance}
              className="text-lg font-semibold text-destructive"
            />
          ) : (
            <p className="text-sm font-medium text-success">لا مديونية</p>
          )}
        </div>
        {hasDebt && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => actions.onCollect(customer.id)}
            className="relative z-10 gap-1.5 font-normal"
          >
            <IconCash className="size-3.5" />
            تحصيل
          </Button>
        )}
      </div>

      <CustomerCreditMeter customer={customer} />

      <p className="text-[11px] text-muted-foreground">
        آخر شراء: {formatDaysAgo(customer.lastPurchaseAt)}
      </p>
    </MotionArticle>
  );
}
