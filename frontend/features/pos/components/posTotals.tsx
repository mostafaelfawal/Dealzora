"use client";

import { IconPlayerPause, IconPercentage, IconX } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { formatQty } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { cartActions } from "../store/cartSlice";
import {
  holdCurrentInvoice,
  requestDialog,
  requestPayment,
} from "../store/posActions";
import { selectInvoiceDiscount, selectTotals } from "../store/selectors";

/** الإجمالي كبير وثابت أسفل الجدول، ومعه أزرار الإجراءات. */
export function PosTotals() {
  const dispatch = useAppDispatch();
  const totals = useAppSelector(selectTotals);
  const discount = useAppSelector(selectInvoiceDiscount);

  const empty = totals.itemCount === 0;
  const discountLabel =
    discount?.type === "percent" ? `الخصم (${discount.value}%)` : "الخصم";

  return (
    <div className="shrink-0 border-t bg-background">
      <dl className="space-y-1 px-4 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">الأصناف</dt>
          <dd className="font-mono tabular-nums" dir="ltr">
            {totals.itemCount} · {formatQty(totals.qtyCount)} وحدة
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">المجموع</dt>
          <dd>
            <Money amount={totals.subtotal} />
          </dd>
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1 text-muted-foreground">
              {discountLabel}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="إزالة الخصم"
                onClick={() => dispatch(cartActions.setDiscount(null))}
              >
                <IconX />
              </Button>
            </dt>
            <dd className="flex items-baseline gap-1">
              <span aria-hidden>−</span>
              <Money amount={totals.discountAmount} />
            </dd>
          </div>
        )}
      </dl>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-end justify-between gap-3 px-4 pt-2 pb-3"
      >
        <span className="pb-1 text-sm font-medium">الإجمالي</span>
        <Money
          amount={totals.total}
          className="text-4xl leading-none sm:text-5xl"
        />
      </div>

      <div className="grid grid-cols-[auto_auto_1fr] gap-2 border-t p-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={empty}
          onClick={() => dispatch(holdCurrentInvoice())}
          className="h-12 gap-2 font-normal lg:h-11"
        >
          <IconPlayerPause className="size-4" />
          <span className="hidden sm:inline">تعليق</span>
          <ShortcutBadge className="hidden rounded-none xl:inline-flex">
            {POS_SHORTCUTS.holdInvoice.label}
          </ShortcutBadge>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={empty}
          onClick={() => dispatch(requestDialog("discount"))}
          className="h-12 gap-2 font-normal lg:h-11"
        >
          <IconPercentage className="size-4" />
          <span className="hidden sm:inline">خصم</span>
          <ShortcutBadge className="hidden rounded-none xl:inline-flex">
            {POS_SHORTCUTS.discount.label}
          </ShortcutBadge>
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={empty}
          onClick={() => dispatch(requestPayment())}
          className="h-12 gap-2 text-base lg:h-11"
        >
          ادفع
          <ShortcutBadge className="rounded-none border-primary-foreground/30 text-primary-foreground/80">
            {POS_SHORTCUTS.pay.label}
          </ShortcutBadge>
        </Button>
      </div>
    </div>
  );
}
