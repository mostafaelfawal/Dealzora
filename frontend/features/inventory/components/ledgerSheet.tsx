"use client";

import { IconAdjustments, IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWhen } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { INVENTORY_SHORTCUTS, MOVEMENT_LABEL } from "../config/inventoryOptions";
import { useLedger } from "../hooks/useInventory";
import type { AdjustTarget } from "./adjustStockDialog";

const PAGE_SIZE = 20;

/** حركة الصنف (Stock Ledger): كل دخول وخروج بسببه والرصيد بعده، الأحدث أولاً. */
export function LedgerSheet({
  target,
  onClose,
  onAdjust,
}: {
  target: AdjustTarget | null;
  onClose: () => void;
  onAdjust: (t: AdjustTarget) => void;
}) {
  const [page, setPage] = useState(1);
  const ledger = useLedger(target?.productId ?? null, page, PAGE_SIZE);
  const items = ledger.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((ledger.data?.total ?? 0) / PAGE_SIZE));

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setPage(1);
        }
      }}
    >
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="text-base">حركة «{target?.name}»</SheetTitle>
          <SheetDescription>
            الرصيد الحالي {formatQty(target?.stock ?? 0)} {target?.unit}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 p-4">
          {target && (
            <Button size="lg" onClick={() => onAdjust(target)} className="gap-2">
              <IconAdjustments className="size-4" />
              تعديل المخزون (جرد / تالف / هدية)
              <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
                {INVENTORY_SHORTCUTS.adjust.label}
              </ShortcutBadge>
            </Button>
          )}
          {ledger.isPending ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : items.length === 0 ? (
            <p className="border border-dashed py-10 text-center text-xs text-muted-foreground">لا توجد حركات بعد</p>
          ) : (
            <ul className="divide-y border">
              {items.map((m, i) => {
                const inbound = m.qtyDelta > 0;
                return (
                  <MotionLi key={m.id} {...listItem(i)} className="flex items-start gap-3 p-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center [&_svg]:size-3.5",
                        inbound ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {inbound ? <IconArrowDown /> : <IconArrowUp />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">{MOVEMENT_LABEL[m.type]}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {m.note || "—"} · {formatWhen(m.createdAt)}
                      </span>
                      {m.unitCost !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          تكلفة <Money amount={m.unitCost} className="text-[10px]" />
                        </span>
                      )}
                    </span>
                    <span className="text-end">
                      <span dir="ltr" className={cn("block font-mono text-sm font-semibold", inbound ? "text-success" : "text-destructive")}>
                        {inbound ? "+" : "−"}
                        {formatQty(Math.abs(m.qtyDelta))}
                      </span>
                      <span className="text-[10px] text-muted-foreground">الرصيد {formatQty(m.balanceAfter)}</span>
                    </span>
                  </MotionLi>
                );
              })}
            </ul>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between text-xs">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                الأحدث
              </Button>
              <span className="font-mono text-muted-foreground">
                {page} / {pages}
              </span>
              <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
                الأقدم
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
