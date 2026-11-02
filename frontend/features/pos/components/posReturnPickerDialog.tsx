"use client";

import { IconReceiptRefund } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useNow } from "@/hooks/useNow";
import { formatItemCount, formatTimeAgo } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { isReturnExpired, returnableQty, soldTotal } from "../lib/returnCalc";
import { openReturn } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectInvoices } from "../store/selectors";

import {
  PosPickerFooter,
  PosPickerHeader,
  pickerItemClass,
} from "./posPickerChrome";

function InvoiceItems() {
  const dispatch = useAppDispatch();
  const invoices = useAppSelector(selectInvoices);
  const now = useNow(30_000);

  return (
    <>
      {invoices.map((inv) => {
        const customerName = inv.customer?.name ?? "عميل نقدي";
        const names = inv.lines.map((l) => l.name).join(" ");
        const fullyReturned = inv.lines.every((l) => returnableQty(l) === 0);
        const partlyReturned =
          !fullyReturned && inv.lines.some((l) => l.returnedQty > 0);
        const expired = now !== null && isReturnExpired(inv.soldAt, now);

        return (
          <CommandItem
            key={inv.id}
            value={`${inv.number} ${customerName} ${names}`}
            disabled={fullyReturned}
            onSelect={() => dispatch(openReturn(inv.id))}
            className={`${pickerItemClass} items-start`}
          >
            <span
              aria-hidden
              className="flex h-9 min-w-12 shrink-0 items-center justify-center bg-muted px-1 font-mono text-xs font-medium text-muted-foreground tabular-nums"
            >
              #{inv.number}
            </span>

            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {customerName}
                </span>
                {fullyReturned && (
                  <Badge variant="outline" className="font-normal">
                    مُرجعة بالكامل
                  </Badge>
                )}
                {partlyReturned && (
                  <Badge
                    variant="outline"
                    className="border-warning/50 font-normal text-warning"
                  >
                    مرتجع جزئي
                  </Badge>
                )}
                {expired && !fullyReturned && (
                  <Badge
                    variant="outline"
                    className="border-destructive/50 font-normal text-destructive"
                  >
                    خارج مهلة الإرجاع
                  </Badge>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {inv.lines.map((l) => l.name).join("، ")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatItemCount(inv.lines.length)} ·{" "}
                {now === null ? "" : formatTimeAgo(inv.soldAt, now)}
              </span>
            </span>

            <Money amount={soldTotal(inv)} className="text-lg font-semibold" />
          </CommandItem>
        );
      })}
    </>
  );
}

/** الخطوة 1: اختيار الفاتورة الأصلية (برقمها أو العميل أو اسم صنف). */
export function PosReturnPickerDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "returnPicker");

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
      className="sm:max-w-xl"
      title="مرتجع أو استبدال"
      description="اختر الفاتورة الأصلية للصنف المراد إرجاعه"
    >
      <PosPickerHeader
        icon={<IconReceiptRefund />}
        title="مرتجع أو استبدال"
        meta="اختر الفاتورة الأصلية"
      />
      <CommandInput placeholder="ابحث برقم الفاتورة أو العميل أو الصنف…" />
      <CommandList className="max-h-[55dvh]">
        <CommandEmpty>
          <div className="space-y-1 py-6 text-xs">
            <p className="text-sm font-medium text-foreground">
              لا توجد فاتورة مطابقة
            </p>
            <p className="text-muted-foreground">
              جرّب رقم الفاتورة أو اسم العميل.
            </p>
          </div>
        </CommandEmpty>
        <CommandGroup heading="آخر الفواتير">
          <InvoiceItems />
        </CommandGroup>
      </CommandList>
      <PosPickerFooter
        hints={[
          { keys: "↑ ↓", label: "تنقل" },
          { keys: "Enter", label: "اختيار" },
          { keys: "Esc", label: "إغلاق" },
        ]}
      />
    </CommandDialog>
  );
}
