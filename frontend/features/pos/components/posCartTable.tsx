"use client";

import { IconAlertTriangle, IconBarcode, IconX } from "@tabler/icons-react";
import { useEffect } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { formatQty, lineTotal } from "../lib/posCalc";
import { cn } from "cn";
import type { CartLine } from "../types/pos";

import { PosQtyField } from "./posQtyField";
import { AppTooltip } from "@/components/shared/AppTooltip";

interface PosCartTableProps {
  lines: CartLine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onStep: (id: string, direction: 1 | -1) => void;
  onRemove: (id: string) => void;
  onFocusSearch: () => void;
}

const th = "h-8 px-2 text-start text-xs font-normal text-muted-foreground";

/**
 * جدول الفاتورة.
 * عمداً <table> عادي وليس shadcn Table: لأن حاوية Table تكسر الترويسة الثابتة (sticky header).
 */
export function PosCartTable({
  lines,
  selectedId,
  onSelect,
  onSetQty,
  onStep,
  onRemove,
  onFocusSearch,
}: PosCartTableProps) {
  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`pos-line-${selectedId}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId, lines.length]);

  if (lines.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
        <IconBarcode className="size-8" />
        <p className="text-sm font-medium text-foreground">الفاتورة فارغة</p>
        <p>امسح باركود أو اكتب اسم صنف، أو اضغط على بطاقة صنف.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b">
            <th scope="col" className={cn(th, "hidden w-8 sm:table-cell")}>
              #
            </th>
            <th scope="col" className={th}>
              الصنف
            </th>
            <th scope="col" className={cn(th, "hidden w-20 sm:table-cell")}>
              السعر
            </th>
            <th scope="col" className={cn(th, "w-36")}>
              الكمية
            </th>
            <th scope="col" className={cn(th, "w-24")}>
              الإجمالي
            </th>
            <th scope="col" className="w-10">
              <span className="sr-only">حذف</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const selected = line.productId === selectedId;
            const overStock = line.qty > line.stock;
            return (
              <tr
                key={line.productId}
                id={`pos-line-${line.productId}`}
                aria-selected={selected}
                onClick={() => onSelect(line.productId)}
                className={cn(
                  "h-14 scroll-mt-8 cursor-pointer border-b lg:h-12",
                  selected && "bg-muted",
                )}
              >
                <td className="hidden px-2 font-mono text-muted-foreground tabular-nums sm:table-cell">
                  {index + 1}
                </td>
                <td className="relative px-2">
                  {selected && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 inset-s-0 w-0.5 bg-primary"
                    />
                  )}
                  <span className="block truncate text-xs font-medium">
                    {line.name}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span dir="ltr" className="hidden font-mono sm:inline">
                      {line.barcode}
                    </span>
                    <span className="sm:hidden">
                      <Money amount={line.price} className="text-[11px]" /> /{" "}
                      {line.unit}
                    </span>
                    {overStock && (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <IconAlertTriangle className="size-3" />
                        أكثر من المتاح ({formatQty(line.stock)})
                      </span>
                    )}
                  </span>
                </td>
                <td className="hidden px-2 sm:table-cell">
                  <Money amount={line.price} className="text-xs" />
                </td>
                <td className="px-2">
                  <PosQtyField
                    line={line}
                    onCommit={(qty) => onSetQty(line.productId, qty)}
                    onStep={(direction) => onStep(line.productId, direction)}
                    onDone={onFocusSearch}
                  />
                </td>
                <td className="px-2">
                  <Money amount={lineTotal(line)} className="text-sm" />
                </td>
                <td className="pe-1">
                  <AppTooltip message={`حذف ${line.name}`} side="right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`حذف ${line.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(line.productId);
                      }}
                      className="size-9 lg:size-7"
                    >
                      <IconX />
                    </Button>
                  </AppTooltip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
