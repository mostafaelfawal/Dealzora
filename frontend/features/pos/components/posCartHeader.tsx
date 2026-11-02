"use client";

import { IconArrowRight, IconTrash, IconUser } from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { formatItemCount } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { requestDialog } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectInvoiceCustomer, selectTotals } from "../store/selectors";

export function PosCartHeader() {
  const dispatch = useAppDispatch();
  const customer = useAppSelector(selectInvoiceCustomer);
  const { itemCount } = useAppSelector(selectTotals);

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      {/* رجوع إلى قائمة الأصناف (الجوال فقط). */}
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="lg:hidden"
        aria-label="رجوع إلى الأصناف"
        onClick={() => dispatch(posUiActions.setMobileView("products"))}
      >
        <IconArrowRight className="size-5" />
      </Button>

      <div className="min-w-0">
        <h2 className="text-sm font-medium">فاتورة جديدة</h2>
        <p className="text-xs text-muted-foreground">
          {formatItemCount(itemCount)}
        </p>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => dispatch(posUiActions.openDialog("customer"))}
          className="max-w-44 gap-2 font-normal"
        >
          <IconUser className="size-4 shrink-0" />
          <span className="truncate">
            {customer ? customer.name : "عميل نقدي"}
          </span>
          <ShortcutBadge className="hidden rounded-none xl:inline-flex">
            {POS_SHORTCUTS.customer.label}
          </ShortcutBadge>
        </Button>

        <AppTooltip
          message={`إلغاء الفاتورة (${POS_SHORTCUTS.cancelInvoice.label})`}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="إلغاء الفاتورة"
            disabled={itemCount === 0}
            onClick={() => dispatch(requestDialog("cancel"))}
          >
            <IconTrash className="size-4" />
          </Button>
        </AppTooltip>
      </div>
    </div>
  );
}
