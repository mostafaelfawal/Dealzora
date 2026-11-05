"use client";

import { IconMapPin, IconPhone } from "@tabler/icons-react";
import Link from "next/link";

import { listItem, MotionArticle } from "@/components/shared/motion";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import {
  BALANCE_LABEL,
  BALANCE_TONE,
  balanceStatus,
} from "../lib/supplierCalc";
import type { Supplier } from "../types/supplier";
import {
  SupplierActionsMenu,
  type SupplierActions,
} from "./supplierActionsMenu";

interface SupplierCardProps extends SupplierActions {
  supplier: Supplier;
  /** ترتيب البطاقة، لتأخير ظهورها قليلاً عن اللي قبلها. */
  index: number;
}

/** بطاقة مورد. الاسم رابط يغطي البطاقة كلها، وقائمة الإجراءات فوقه. */
export function SupplierCard({
  supplier,
  index,
  ...actions
}: SupplierCardProps) {
  const status = balanceStatus(supplier.balance);

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
          "flex items-start gap-2",
          !supplier.isActive && "opacity-60",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={SUPPLIER_ROUTES.edit(supplier.id)}
            className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-primary/40"
          >
            {supplier.name}
          </Link>
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <IconPhone className="size-3.5 shrink-0" aria-hidden />
            <span
              dir="ltr"
              className="min-w-0 truncate text-start font-mono text-[11px]"
            >
              {supplier.phone || "بدون هاتف"}
            </span>
          </span>
          {supplier.address && (
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <IconMapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate text-[11px]">
                {supplier.address}
              </span>
            </span>
          )}
        </div>
        <div className="relative z-10 -mt-1 -ms-1 shrink-0">
          <SupplierActionsMenu supplier={supplier} {...actions} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {!supplier.isActive && (
          <Badge variant="secondary" className="font-normal">
            معطّل
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn("font-normal", BALANCE_TONE[status])}
        >
          {BALANCE_LABEL[status]}
        </Badge>
      </div>

      <div
        className={cn(
          "flex items-end justify-between gap-2 border-t border-border/60 pt-2.5",
          !supplier.isActive && "opacity-60",
        )}
      >
        <span className="text-[11px] text-muted-foreground">
          {status === "advance" ? "رصيد لنا عنده" : "المستحق له"}
        </span>
        <Money
          amount={Math.abs(supplier.balance)}
          className="text-lg font-semibold"
        />
      </div>
    </MotionArticle>
  );
}
