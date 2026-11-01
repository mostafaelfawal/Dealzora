"use client";

import { Money } from "@/components/shared/Money";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatTime } from "@/lib/format";
import { calcTotals } from "../lib/posCalc";
import type { HeldInvoice } from "../types/pos";

interface PosHeldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  held: HeldInvoice[];
  /** لو الفاتورة الحالية فيها أصناف، هتتعلّق تلقائي عند الاسترجاع. */
  currentHasItems: boolean;
  onRecall: (id: string) => void;
}

export function PosHeldDialog({
  open,
  onOpenChange,
  held,
  currentHasItems,
  onRecall,
}: PosHeldDialogProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
      title="الفواتير المعلّقة"
      description={
        currentHasItems
          ? "اختار فاتورة لاسترجاعها. الفاتورة الحالية هتتعلّق تلقائي."
          : "اختار فاتورة لاسترجاعها."
      }
    >
      <CommandInput placeholder="ابحث باسم العميل أو الصنف…" />
      <CommandList>
        <CommandEmpty>مفيش فواتير معلّقة</CommandEmpty>
        <CommandGroup>
          {held.map((h) => {
            const totals = calcTotals(h.invoice);
            const names = h.invoice.lines.map((l) => l.name).join(" ");
            return (
              <CommandItem
                key={h.id}
                value={`${h.id} ${h.invoice.customer?.name ?? "نقدي"} ${names}`}
                onSelect={() => onRecall(h.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {h.invoice.customer?.name ?? "عميل نقدي"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {totals.itemCount} صنف · اتعلّقت{" "}
                    {formatTime(new Date(h.heldAt).toISOString())}
                  </span>
                </span>
                <Money amount={totals.total} />
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
